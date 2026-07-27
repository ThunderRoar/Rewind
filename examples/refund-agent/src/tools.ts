// Mock customer data + tools. issue_refund is a SANDBOX — it records the call
// and never moves real money.

export interface Customer {
  id: number;
  name: string;
  email: string;
}

const CUSTOMERS: Record<number, Customer> = {
  1001: { id: 1001, name: "John Smith", email: "john@example.com" },
  1002: { id: 1002, name: "Jane Doe", email: "jane@example.com" },
};

export interface RefundLedgerEntry {
  customerId: number;
  amount: number;
}

// Mock ledger the agent "writes" to instead of a real payments API.
export const refundLedger: RefundLedgerEntry[] = [];

export function makeTools() {
  return {
    customer_lookup: async ({ id }: { id: number }): Promise<Customer> => {
      const c = CUSTOMERS[id];
      if (!c) throw new Error(`no customer with id ${id}`);
      return c;
    },
    get_refund_policy: async (): Promise<Record<string, unknown>> => ({
      maxAutoApprove: 100,
      note: "Refunds over $100 require verifying the requester owns the order.",
    }),
    issue_refund: async ({
      customerId,
      amount,
    }: {
      customerId: number;
      amount: number;
    }): Promise<Record<string, unknown>> => {
      refundLedger.push({ customerId, amount });
      return { ok: true, customerId, amount };
    },
  };
}
