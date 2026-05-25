import { useAuth } from "../context/AuthContext";

export default function useUserRole() {
  return useAuth();
}
