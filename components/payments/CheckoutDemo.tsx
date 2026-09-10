"use client";

import { useState } from "react";
import { PaymentModal } from "./PaymentModal";

export function CheckoutDemo() {
  const [open, setOpen] = useState(false);
  return (
    <section className="px-6 py-10">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 bg-[#00E5C8] px-6 text-sm font-bold uppercase tracking-wider text-[#031211]"
      >
        Pay for resource
      </button>
      <PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        sku="math-notes"
        amount={50}
        currency="KES"
        country="KE"
        description="Grade 6 Mathematics notes"
        metadata={{ resource_type: "Notes", grade_level: "Grade 6", item: "math-notes" }}
      />
    </section>
  );
}
