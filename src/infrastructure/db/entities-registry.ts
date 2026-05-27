/**
 * Shared TypeORM entity list for all DataSource configurations.
 *
 * @module infrastructure/db/entities-registry
 */

import User from "../../entities/User.js";
import TempLink from "../../entities/TempLink.js";
import TopUp from "../../entities/TopUp.js";
import DomainRequest from "../../entities/DomainRequest.js";
import Promo from "../../entities/Promo.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import DomainService from "../../entities/DomainService.js";
import Ticket from "../../entities/Ticket.js";
import Broadcast from "../../entities/Broadcast.js";
import BroadcastLog from "../../entities/BroadcastLog.js";
import DedicatedServer from "../../entities/DedicatedServer.js";
import TicketAudit from "../../entities/TicketAudit.js";
import Domain from "../../entities/Domain.js";
import DomainOperation from "../../entities/DomainOperation.js";
import ReferralReward from "../../entities/ReferralReward.js";
import ServiceInvoice from "../../entities/ServiceInvoice.js";
import GrowthEvent from "../../entities/GrowthEvent.js";
import CdnProxyService from "../../entities/CdnProxyService.js";
import CdnProxyAudit from "../../entities/CdnProxyAudit.js";
import DedicatedServerOrder from "../../entities/DedicatedServerOrder.js";
import ProvisioningTicket from "../../entities/ProvisioningTicket.js";
import ProvisioningTicketStatusHistory from "../../entities/ProvisioningTicketStatusHistory.js";
import ProvisioningTicketNote from "../../entities/ProvisioningTicketNote.js";
import ProvisioningTicketAssignment from "../../entities/ProvisioningTicketAssignment.js";
import ProvisioningTicketChecklist from "../../entities/ProvisioningTicketChecklist.js";
import ProvisioningTicketEvent from "../../entities/ProvisioningTicketEvent.js";
import {
  AutomationScenario,
  ScenarioVersion,
  UserNotificationState,
  OfferInstance,
  AutomationEventLog,
  ScenarioMetric,
} from "../../entities/automations/index.js";
import AdminAuditLog from "../../entities/AdminAuditLog.js";
import Reseller from "../../entities/Reseller.js";
import ResellerApiKey from "../../entities/ResellerApiKey.js";
import ResellerAuditLog from "../../entities/ResellerAuditLog.js";
import {
  NotificationJob,
  NotificationDelivery,
  UserEngagementProfile,
  UserFunnelState,
} from "../../entities/notifications/index.js";

export const appEntities = [
  User,
  TempLink,
  TopUp,
  DomainRequest,
  Promo,
  VirtualDedicatedServer,
  DomainService,
  Ticket,
  Broadcast,
  BroadcastLog,
  DedicatedServer,
  TicketAudit,
  Domain,
  DomainOperation,
  ReferralReward,
  ServiceInvoice,
  GrowthEvent,
  CdnProxyService,
  CdnProxyAudit,
  DedicatedServerOrder,
  ProvisioningTicket,
  ProvisioningTicketStatusHistory,
  ProvisioningTicketNote,
  ProvisioningTicketAssignment,
  ProvisioningTicketChecklist,
  ProvisioningTicketEvent,
  AutomationScenario,
  ScenarioVersion,
  UserNotificationState,
  OfferInstance,
  AutomationEventLog,
  ScenarioMetric,
  AdminAuditLog,
  Reseller,
  ResellerApiKey,
  ResellerAuditLog,
  NotificationJob,
  NotificationDelivery,
  UserEngagementProfile,
  UserFunnelState,
];
