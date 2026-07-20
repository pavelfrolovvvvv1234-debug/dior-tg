import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminBillingNotifyCard,
  formatAdminBillingUsd,
  paymentProviderLabel,
} from "../admin-billing-notify-card.js";

describe("admin billing notify card", () => {
  it("formats USD and provider labels", () => {
    assert.equal(formatAdminBillingUsd(100), "$100.00");
    assert.equal(paymentProviderLabel("heleket"), "Heleket");
  });

  it("builds premium card with divider sections", () => {
    const text = buildAdminBillingNotifyCard({
      title: "Balance credited",
      rows: [
        { label: "Amount", value: "$100.00" },
        { label: "Customer", value: "user@example.com" },
        { label: "Provider", value: "Heleket" },
        { label: "Reference", value: "TOP-260719-768857" },
      ],
      actionLink: { label: "View payment", url: "https://pay.example/inv/1" },
    });

    assert.match(text, /Balance credited/);
    assert.match(text, /───────────────/);
    assert.match(text, /<b>Amount<\/b>/);
    assert.match(text, /TOP-260719-768857/);
    assert.match(text, /<a href="https:\/\/pay\.example\/inv\/1">View payment<\/a>/);
  });
});
