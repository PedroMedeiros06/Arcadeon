import { redirect } from "next/navigation";

// O inventario agora fica dentro do perfil; mantem links antigos funcionando.
export default function InventoryPage() {
  redirect("/profile");
}
