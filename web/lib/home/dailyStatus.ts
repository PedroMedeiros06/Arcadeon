import { fetchDailyStatus, type DailyStatus } from "@/lib/termo/daily";
import { createOnce } from "./dailyCache";

/** Status do Letrado de hoje; home e barra lateral dividem a mesma requisicao em andamento. */
export const getDailyStatusShared: (key: string) => Promise<DailyStatus> = createOnce(fetchDailyStatus);
