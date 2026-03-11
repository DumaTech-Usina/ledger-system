import { RejectedEvent } from "../../domain/entities/RejectedEvent";

export interface RejectedEventRepository {
  save(event: RejectedEvent): Promise<void>;

  findAll(): Promise<RejectedEvent[]>;
}
