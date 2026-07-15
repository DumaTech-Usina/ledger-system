import { CashMovement, CashMovementPage } from "../dtos/CashStatement";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { Direction } from "../../domain/enums/Direction";

export class CashEventListingService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async list(params: {
    partyId: string;
    from?: Date;
    to?: Date;
    limit: number;
    cursor?: string;
  }): Promise<CashMovementPage> {
    const limit = Math.min(Math.max(1, params.limit), 200);
    const cursor = params.cursor ? this.decodeCursor(params.cursor) : undefined;

    const { items, hasMore, nextCursor: rawCursor } = await this.repo.findCashMovementsPaginated({
      partyId: params.partyId,
      from: params.from,
      to: params.to,
      limit,
      cursor,
    });

    const nextCursor = rawCursor ? this.encodeCursor(rawCursor) : null;

    return {
      items: items.map((e) => this.toMovement(e)),
      nextCursor,
      hasMore,
    };
  }

  private toMovement(event: LedgerEvent): CashMovement {
    return {
      eventId: event.id.value,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      effect: event.economicEffect as "cash_in" | "cash_out",
      amount: event.amount,
      sourceReference: event.source.reference ?? null,
      // For a cash movement the usina is the party that moves cash (IN/OUT); the counterparty is
      // therefore the NEUTRAL party.
      counterparty: event.getParties().find((p) => p.direction === Direction.NEUTRAL)?.partyId.value ?? null,
      description: event.description,
    };
  }

  private encodeCursor(rawCursor: { occurredAt: Date; id: string }): string {
    return Buffer.from(
      JSON.stringify({ occurredAt: rawCursor.occurredAt.toISOString(), id: rawCursor.id }),
    ).toString("base64");
  }

  private decodeCursor(cursor: string): { occurredAt: Date; id: string } {
    const { occurredAt, id } = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    return { occurredAt: new Date(occurredAt), id };
  }
}
