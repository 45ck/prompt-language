export interface Order {
  id: string;
  quantity: number;
  status: string;
  notes: string;
}

export function createOrder(input: Partial<Order> = {}): Order {
  return {
    id: input.id ?? '',
    quantity: input.quantity ?? 0,
    status: input.status ?? 'draft',
    notes: input.notes ?? '',
  };
}
