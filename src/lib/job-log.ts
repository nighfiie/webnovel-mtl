export interface JobLogEntry { id: number; message: string; status: "info" | "success" | "error" }
export function prependJobLog(entries: JobLogEntry[], entry: JobLogEntry): JobLogEntry[] {
  return [entry, ...entries];
}
