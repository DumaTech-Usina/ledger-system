export interface MessagePublisherPort {
  publish(routingKey: string, message: { messageId: string; type: string }): Promise<void>;
}
