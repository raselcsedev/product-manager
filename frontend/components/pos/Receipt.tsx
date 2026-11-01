import "./print.css";
import { formatMoney } from "@/lib/pos";
import { formatFull } from "@/lib/time";
import { Sale } from "@/types/pos";

// A receipt. The classes "print-area" and "receipt" make it the only thing that is printed (see print.css).
// It uses fixed colors (black on white) on purpose, so it prints the same in dark mode.
export default function Receipt({ sale }: { sale: Sale }) {
  const dashed = "border-t border-dashed border-[#999]";

  return (
    <div className="print-area receipt mx-auto w-full max-w-sm rounded-md border border-[#ccc] bg-[#fff] p-5 font-mono text-[13px] leading-snug text-[#111]">
      <div className="text-center">
        <p className="text-base font-bold">{sale.shopName}</p>
        <p>Receipt {sale.receiptNumber}</p>
        <p className="text-[#555]">{formatFull(sale.createdAt)}</p>
        <p className="text-[#555]">Cashier: {sale.cashierName}</p>
      </div>

      {sale.isVoided && (
        <div className="mt-3 border-2 border-[#111] py-1 text-center text-base font-bold tracking-widest">VOID</div>
      )}

      <div className={`mt-3 space-y-2 pt-3 ${dashed}`}>
        {sale.items.map((item) => (
          <div key={item.id}>
            <p className="break-words">{item.productName}</p>
            <p className="flex justify-between text-[#555]">
              <span>
                {item.quantity} x {formatMoney(item.unitPrice)}
              </span>
              <span className="text-[#111]">{formatMoney(item.lineTotal)}</span>
            </p>
          </div>
        ))}
      </div>

      <div className={`mt-3 space-y-1 pt-3 ${dashed}`}>
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(sale.subtotal)}</span>
        </p>
        {sale.discountAmount > 0 && (
          <p className="flex justify-between">
            <span>Discount</span>
            <span>-{formatMoney(sale.discountAmount)}</span>
          </p>
        )}
        {sale.taxAmount > 0 && (
          <p className="flex justify-between">
            <span>Tax ({sale.taxRatePercent}%)</span>
            <span>{formatMoney(sale.taxAmount)}</span>
          </p>
        )}
        <p className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(sale.total)}</span>
        </p>
      </div>

      <div className={`mt-3 space-y-1 pt-3 ${dashed}`}>
        <p className="flex justify-between">
          <span>Paid by</span>
          <span>{sale.paymentMethod}</span>
        </p>
        {sale.paymentMethod === "Cash" && (
          <>
            <p className="flex justify-between">
              <span>Cash received</span>
              <span>{formatMoney(sale.amountTendered)}</span>
            </p>
            <p className="flex justify-between">
              <span>Change</span>
              <span>{formatMoney(sale.changeGiven)}</span>
            </p>
          </>
        )}
      </div>

      {sale.isVoided && sale.voidReason && <p className={`mt-3 pt-3 ${dashed}`}>Voided: {sale.voidReason}</p>}

      <p className={`mt-3 pt-3 text-center ${dashed}`}>Thank you!</p>
    </div>
  );
}
