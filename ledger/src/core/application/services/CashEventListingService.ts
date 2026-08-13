import {
  CashMovement,
  CashMovementCursor,
  CashMovementPage,
  CashMovementSortKey,
} from "../dtos/CashStatement";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { Direction } from "../../domain/enums/Direction";

export class CashEventListingService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async list(params: {
    /** Absent lists the whole book's cash movements instead of one party's statement. */
    partyId?: string;
    /** Absent lists both directions; a statement is both, and neither is the default. */
    effect?: "cash_in" | "cash_out";
    from?: Date;
    to?: Date;
    limit: number;
    cursor?: string;
    /** A numbered page. Ignored when a cursor is given — a cursor already says where it is. */
    page?: number;
    sortBy?: CashMovementSortKey;
    sortOrder?: "ASC" | "DESC";
  }): Promise<CashMovementPage> {
    const limit = Math.min(Math.max(1, params.limit), 200);
    const sortBy = params.sortBy ?? "occurredAt";
    const sortOrder = params.sortOrder ?? "DESC";
    const cursor = params.cursor ? this.decodeCursor(params.cursor, sortBy, sortOrder) : undefined;

    const result = await this.repo.findCashMovementsPaginated({
      partyId: params.partyId,
      effect: params.effect,
      from: params.from,
      to: params.to,
      limit,
      sortBy,
      sortOrder,
      cursor,
      // A cursor already names a position; a page number alongside it would name a second, and the
      // two would disagree. The cursor wins because it is the more specific statement.
      page: cursor ? undefined : params.page,
    });

    return {
      items: result.items.map((e) => this.toMovement(e)),
      nextCursor: result.nextCursor ? this.encodeCursor(result.nextCursor) : null,
      hasMore: result.hasMore,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  private toMovement(event: LedgerEvent): CashMovement {
    const parties = event.getParties();
    return {
      eventId: event.id.value,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      effect: event.economicEffect as "cash_in" | "cash_out",
      amount: event.amount,
      sourceReference: event.source.reference ?? null,
      sourceSystem: event.source.system ?? null,
      objects: event.getObjects().map((o) => ({
        objectId: o.objectId.value,
        objectType: o.objectType,
        relation: o.relation,
      })),
      parties: parties.map((p) => ({
        partyId: p.partyId.value,
        role: p.role,
        direction: p.direction,
        amount: p.amount,
      })),
      // For a cash movement the usina is the party that moves cash (IN/OUT); the counterparty is
      // therefore the NEUTRAL party.
      counterparty: parties.find((p) => p.direction === Direction.NEUTRAL)?.partyId.value ?? null,
      description: event.description,
    };
  }

  /** The cursor carries the ordering it belongs to, so a later request can be checked against it. */
  private encodeCursor(cursor: CashMovementCursor): string {
    return Buffer.from(
      JSON.stringify({
        key: cursor.key,
        order: cursor.order,
        value: cursor.value.toISOString(),
        id: cursor.id,
      }),
    ).toString("base64");
  }

  /**
   * Reads a cursor and REFUSES it when it was issued for a different ordering.
   *
   * Replaying a keyset position under another ordering does not fail loudly on its own — it just
   * returns the wrong rows, silently skipping or repeating part of the list. Refusing is the only
   * behaviour that keeps a paged read honest, so the mismatch is an error rather than a surprise.
   *
   * A cursor with no ordering in it predates this and is read as the old one (`occurredAt`), then
   * checked like any other.
   */
  private decodeCursor(
    cursor: string,
    sortBy: CashMovementSortKey,
    sortOrder: "ASC" | "DESC",
  ): CashMovementCursor {
    let decoded: { key?: string; order?: string; value?: string; occurredAt?: string; id?: string };
    try {
      decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch {
      throw new CursorMismatchError("Cursor is not readable");
    }

    const key = (decoded.key ?? "occurredAt") as CashMovementSortKey;
    const order = (decoded.order ?? sortOrder) as "ASC" | "DESC";
    const rawValue = decoded.value ?? decoded.occurredAt;
    if (!rawValue || !decoded.id) throw new CursorMismatchError("Cursor is not readable");
    if (key !== sortBy || order !== sortOrder) {
      throw new CursorMismatchError(
        `Cursor belongs to ${key} ${order}; this request asks for ${sortBy} ${sortOrder}`,
      );
    }

    return { key, order, value: new Date(rawValue), id: decoded.id };
  }
}

/** A cursor that does not describe the ordering being asked for. A client error, not a book error. */
export class CursorMismatchError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "CursorMismatchError";
  }
}
