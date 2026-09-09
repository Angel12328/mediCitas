"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ScheduleItem } from "@/modules/schedules/queries";
import { bitmaskToDays, DIAS } from "@/modules/schedules/queries";

interface WeeklyScheduleListProps {
  schedules: ScheduleItem[];
  onSelect: (schedule: ScheduleItem) => void;
  doctorName: string;
  specialtyName: string;
}

function formatDaysLabel(bitmask: number): string {
  const days = bitmaskToDays(bitmask);
  if (days.length === 0) return "Sin días";
  if (days.length === 7) return "Lun–Dom";

  // Check if consecutive
  let isConsecutive = true;
  for (let i = 1; i < days.length; i++) {
    if (days[i] !== days[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  const dayNames = days.map((d) => DIAS[d]);
  if (isConsecutive) {
    return `${dayNames[0]}–${dayNames[dayNames.length - 1]}`;
  }
  return dayNames.join(", ");
}

function getTimeIcon(startTime: string): string {
  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour >= 6 && hour < 12) return "☀";
  if (hour >= 12 && hour < 18) return "🌤";
  return "🌙";
}

export function WeeklyScheduleList({
  schedules,
  onSelect,
  doctorName,
  specialtyName,
}: WeeklyScheduleListProps) {
  // Group schedules by daysBitmask
  const groups = new Map<number, ScheduleItem[]>();
  for (const s of schedules) {
    const key = s.daysBitmask;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold">{doctorName}</h3>
        <span className="text-sm text-muted-foreground">{specialtyName}</span>
      </div>

      <div className="max-h-[50vh] overflow-y-auto">
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([bitmask, items]) => (
            <div key={bitmask} className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {formatDaysLabel(bitmask)}
              </h4>
              {items.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTimeIcon(schedule.startTime)}</span>
                    <div>
                      <p className="font-medium text-sm">
                        {schedule.startTime.slice(0, 5)}–{schedule.endTime.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Capacidad: {schedule.slotCapacity} por día
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelect(schedule)}
                    className="whitespace-nowrap"
                  >
                    Seleccionar
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}