"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WeeklyScheduleList } from "./weekly-schedule-list";
import { DatePickerWithAvailability } from "./date-picker-with-availability";
import type { ScheduleItem } from "@/modules/schedules/queries";
import { cn } from "@/lib/utils";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  specialtyId: string;
  doctorName: string;
  specialtyName: string;
  schedules: ScheduleItem[];
  onSelect: (scheduleId: string, date: string) => void;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  doctorId,
  specialtyId,
  doctorName,
  specialtyName,
  schedules,
  onSelect,
}: ScheduleDialogProps) {
  const [view, setView] = useState<"weekly" | "datePicker">("weekly");
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);

  const handleScheduleSelect = (schedule: ScheduleItem) => {
    setSelectedSchedule(schedule);
    setView("datePicker");
  };

  const handleDateSelect = (date: string, available: number) => {
    if (!selectedSchedule) return;
    onSelect(selectedSchedule.id, date);
    onOpenChange(false);
    setView("weekly");
    setSelectedSchedule(null);
  };

  const handleBack = () => {
    setView("weekly");
    setSelectedSchedule(null);
  };

  if (!open) return null;

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-hidden",
          "sm:max-w-2xl max-w-full",
        )}
      >
        <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-lg font-semibold">
            {doctorName} — {specialtyName}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogHeader>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {view === "weekly" && (
            <WeeklyScheduleList
              schedules={schedules}
              onSelect={handleScheduleSelect}
              doctorName={doctorName}
              specialtyName={specialtyName}
            />
          )}

          {view === "datePicker" && selectedSchedule && (
            <DatePickerWithAvailability
              scheduleId={selectedSchedule.id}
              specialtyId={specialtyId}
              doctorId={doctorId}
              schedule={{
                startTime: selectedSchedule.startTime,
                endTime: selectedSchedule.endTime,
                slotCapacity: selectedSchedule.slotCapacity,
              }}
              onSelect={handleDateSelect}
              onBack={handleBack}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}