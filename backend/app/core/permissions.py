from enum import Enum
from typing import Set


class Role(str, Enum):
    DIRECTOR = "director"
    SENIOR_DOCTOR = "senior_doctor"
    JUNIOR_DOCTOR = "junior_doctor"
    RECEPTIONIST = "receptionist"
    PATIENT = "patient"


ROLE_PERMISSIONS: dict[str, Set[str]] = {
    Role.DIRECTOR: {
        "users:create", "users:read", "users:update", "users:delete",
        "patients:read", "ct_scans:read", "predictions:read",
        "reports:read", "appointments:read",
        "analytics:read", "audit:read",
        "reports:export",
    },
    Role.SENIOR_DOCTOR: {
        "patients:read", "ct_scans:read", "predictions:read",
        "reports:read", "reports:approve", "reports:reject",
        "reports:publish", "recommendations:create",
        "appointments:read",
    },
    Role.JUNIOR_DOCTOR: {
        "patients:read", "ct_scans:create", "ct_scans:read",
        "predictions:create", "predictions:read",
        "reports:create", "reports:read",
        "appointments:read",
    },
    Role.RECEPTIONIST: {
        "patients:create", "patients:read", "patients:update",
        "appointments:create", "appointments:read",
        "appointments:update", "appointments:cancel",
        "ct_scans:request",
    },
    Role.PATIENT: {
        "patients:read_own", "reports:read_own",
        "ct_scans:read_own", "predictions:read_own",
        "appointments:create", "appointments:read_own",
    },
}


def has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms


CREATABLE_ROLES_BY = {
    Role.DIRECTOR: [Role.JUNIOR_DOCTOR, Role.SENIOR_DOCTOR, Role.RECEPTIONIST],
    Role.RECEPTIONIST: [Role.PATIENT],
}
