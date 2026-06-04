import { useContext } from "react";
import { AuthContext } from "../providers/authProvider";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const usePermissions = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return {
      canViewUsers: false,
      canAuditLogs: false,
      canReviewInvoices: false,
      canRunWorkflows: false,
      canAccessFinance: false,
      canAccessCRM: false,
      canAccessTelemetry: false,
      hasRole: (role: string) => false,
    };
  }

  const role = currentUser.role;

  return {
    canViewUsers: role === "admin",
    canAuditLogs: role === "admin" || role === "compliance_officer",
    canReviewInvoices: ["admin", "compliance_officer", "reviewer", "finance_manager"].includes(role),
    canRunWorkflows: ["admin", "operations_manager", "finance_manager"].includes(role),
    canAccessFinance: ["admin", "finance_manager"].includes(role),
    canAccessCRM: ["admin", "sales_rep"].includes(role),
    canAccessTelemetry: ["admin", "analyst"].includes(role),
    hasRole: (checkRole: string) => role === checkRole,
  };
};
