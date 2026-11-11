"use client";

import { useState } from "react";
import { ArrowDownLeft, Banknote, FileSignature, HandCoins, PackageMinus, PackagePlus, Plus, Receipt, Truck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Dropdown } from "@/components/ui/Dropdown";
import { ClientPaymentForm } from "@/components/forms/clients";
import { ContractForm, ContractorPaymentForm } from "@/components/forms/contractors";
import { DeliveryForm, SupplierPaymentForm } from "@/components/forms/suppliers";
import { StockMovementForm } from "@/components/forms/inventory";
import { ExpenseForm, WithdrawalForm } from "@/components/forms/finance";

type Form = "payment" | "contract" | "contractorPay" | "delivery" | "supplierPay" | "consume" | "expense" | "withdrawal";

/** "Add" menu on a project page: every entry is pre-filled with the project. */
export function QuickAdd({ projectId }: { projectId: string }) {
  const { canEdit } = useStore();
  const [form, setForm] = useState<Form>();
  if (!canEdit) return null;
  const close = () => setForm(undefined);
  return (
    <>
      <Dropdown
        label={<><Plus className="size-4" /> Add entry</>}
        items={[
          { label: "Client payment", description: "Money received from the client", icon: <ArrowDownLeft className="size-4" />, onSelect: () => setForm("payment") },
          { label: "Receive material", description: "Delivery from a supplier (adds stock)", icon: <PackagePlus className="size-4" />, onSelect: () => setForm("delivery") },
          { label: "Pay supplier", description: "Advance or payment against deliveries", icon: <Truck className="size-4" />, onSelect: () => setForm("supplierPay") },
          { label: "New contract", description: "Give work to a contractor", icon: <FileSignature className="size-4" />, onSelect: () => setForm("contract") },
          { label: "Pay contractor", description: "Advance, installment or final", icon: <Banknote className="size-4" />, onSelect: () => setForm("contractorPay") },
          { label: "Material used / wastage", description: "Reduce site stock", icon: <PackageMinus className="size-4" />, onSelect: () => setForm("consume") },
          { label: "Site expense", description: "Labour, transport, bills, misc.", icon: <Receipt className="size-4" />, onSelect: () => setForm("expense") },
          { label: "Partner withdrawal", description: "Not an expense", icon: <HandCoins className="size-4" />, onSelect: () => setForm("withdrawal") },
        ]}
      />
      {form === "payment" && <ClientPaymentForm projectId={projectId} onClose={close} />}
      {form === "contract" && <ContractForm projectId={projectId} onClose={close} />}
      {form === "contractorPay" && <ContractorPaymentForm projectId={projectId} onClose={close} />}
      {form === "delivery" && <DeliveryForm projectId={projectId} onClose={close} />}
      {form === "supplierPay" && <SupplierPaymentForm projectId={projectId} onClose={close} />}
      {form === "consume" && <StockMovementForm projectId={projectId} onClose={close} />}
      {form === "expense" && <ExpenseForm projectId={projectId} onClose={close} />}
      {form === "withdrawal" && <WithdrawalForm projectId={projectId} onClose={close} />}
    </>
  );
}

