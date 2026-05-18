export interface MessagePublisher {
  publish(routingKey: string, payload: unknown): Promise<void>;
}
