import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_CREATE_SERVICE_CANCEL,
  isAdminCreateServiceReviewCallback,
  isAdminCreateServiceWizardActive,
  isAdminCreateServiceWizardCallback,
  resetAdminCreateServiceWizardState,
} from "../admin-create-service-session.js";
import type { SessionData } from "../../types/session.js";
import { createInitialOtherSession } from "../../session-initial.js";

describe("admin create service session", () => {
  it("cancel callback matches keyboard data", () => {
    assert.equal(ADMIN_CREATE_SERVICE_CANCEL, "advcs:cancel");
  });

  it("distinguishes wizard vs admin navigation callbacks", () => {
    assert.equal(isAdminCreateServiceWizardCallback("advcs:cancel"), true);
    assert.equal(isAdminCreateServiceWizardCallback("admin-menu-back"), false);
    assert.equal(isAdminCreateServiceWizardCallback("adv:pg:1"), false);
  });

  it("matches only review-step resume callbacks", () => {
    assert.equal(isAdminCreateServiceReviewCallback("advcs:submit"), true);
    assert.equal(isAdminCreateServiceReviewCallback("advcs:toggle-confirm"), true);
    assert.equal(isAdminCreateServiceReviewCallback("advcs:goto:form"), true);
    assert.equal(isAdminCreateServiceReviewCallback("advcs:skip"), false);
    assert.equal(isAdminCreateServiceReviewCallback("advcs:stype:vds"), false);
  });

  it("detects active wizard by step", () => {
    const session = {
      main: { user: { id: 1, role: 1, balance: 0 }, locale: "ru" },
      other: createInitialOtherSession(),
    } as SessionData;
    assert.equal(isAdminCreateServiceWizardActive(session), false);
    session.other.adminCreateService = {
      step: "form",
      serviceType: "domain",
      draft: {},
      formFieldIndex: 0,
      assignedUserId: null,
      assignedUserTelegramId: null,
      confirmed: false,
      createdSummary: null,
      createdServiceRef: null,
      messageId: null,
      chatId: null,
    };
    assert.equal(isAdminCreateServiceWizardActive(session), true);
    resetAdminCreateServiceWizardState(session);
    assert.equal(isAdminCreateServiceWizardActive(session), false);
  });
});
