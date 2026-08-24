export function getRoleHomePath(role: "patient" | "doctor" | "admin"): string {
  switch (role) {
    case "patient":
      return "/dashboard";
    case "doctor":
      return "/doctor/queue";
    case "admin":
      return "/admin/payments";
  }
}