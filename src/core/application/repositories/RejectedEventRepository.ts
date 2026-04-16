import { RejectedEvent } from "../../domain/entities/RejectedEvent";
import { Page, PageOptions } from "../dtos/Pagination";

export interface RejectedEventRepository {
  save(event: RejectedEvent): Promise<void>;

  findAll(): Promise<RejectedEvent[]>;

  findPaginated(options: PageOptions): Promise<Page<RejectedEvent>>;
}
