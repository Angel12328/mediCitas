"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BatchAvailabilityItem, BatchAvailabilityResponse } from "@/modules/schedules/queries";
import { useScheduleAvailability } from "@/modules/schedules/queries";

interface DatePickerWithAvailabilityProps {
  scheduleId: string;
  specialtyId: string;
  doctorId: string;
  schedule: { startTime: string; endTime: string; slotCapacity: number };
  onSelect: (date: string, available: number) => void;
  onBack: () => void;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function DatePickerWithAvailability({
  scheduleId,
  specialtyId,
  doctorId,
  schedule,
  onSelect,
  onBack,
}: DatePickerWithAvailabilityProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate start/end date for current month
  const startDate = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return new Date(year, month, 1).toISOString().slice(0, 10);
  }, [currentMonth]);

  const endDate = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return new Date(year, month + 1, 0).toISOString().slice(0, 10);
  }, [currentMonth]);

  const { data: availability } = useScheduleAvailability(
    scheduleId,
    startDate,
    endDate,
    specialtyId,
    doctorId
  );

  const monthName = `${MESES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: (string | null)[] = [];

    // Previous month padding
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(year, month, d).toISOString().slice(0, 10);
      days.push(dateStr);
    }

    return days;
  }, [currentMonth]);

  const getAvailabilityForDate = (dateStr: string): BatchAvailabilityItem | undefined => {
    if (!availability?.items) return undefined;
    return availability.items.find((item) => item.date === dateStr);
  };

  const isDateAvailable = (dateStr: string): boolean => {
    const item = getAvailabilityForDate(dateStr);
    return item !== undefined && item.available > 0;
  };

  const isDateInSchedule = (dateStr: string): boolean => {
    const item = getAvailabilityForDate(dateStr);
    return item !== undefined;
  };

  const isPastDate = (dateStr: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(`${dateStr}T00:00:00`);
    return date < today;
  };

  const handleDayClick = (dateStr: string | null) => {
    if (!dateStr) return;
    if (isPastDate(dateStr)) return;
    const item = getAvailabilityForDate(dateStr);
    if (!item || item.available === 0) return;
    setSelectedDate(dateStr);
    onSelect(dateStr, item.available);
  };

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <div className="space-y-4">
      {/* Header with schedule info */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{schedule.startTime.slice(0, 5)}–{schedule.endTime.slice(0, 5)}</p>
              <p className="text-sm text-muted-foreground">{schedule.slotCapacity} cupos por día</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Volver
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-2">
          <CardTitle className="text-lg">{monthName}</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mes anterior">
              ◀
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mes siguiente">
              ▶
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 text-center text-sm p-2 border-b">
            {DIAS.map((d) => (
              <div key={d} className="py-2 font-medium text-xs text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 p-2 gap-1">
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} className="aspect-square" />;

              const available = isDateAvailable(dateStr);
              const inSchedule = isDateInSchedule(dateStr);
              const past = isPastDate(dateStr);
              const selected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  disabled={!available || past}
                  className={cn(
                    "aspect-square rounded-md text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    past && "text-muted-foreground/30 cursor-not-allowed",
                    !inSchedule && "text-muted-foreground/30 cursor-not-allowed",
                    inSchedule && !available && !past && "bg-destructive/10 text-destructive cursor-not-allowed",
                    available && !past && "bg-green-100 text-green-900 hover:bg-green-200 cursor-pointer",
                    selected && "ring-2 ring-primary ring-offset-2",
                  )}
                  aria-label={`${DIAS[new Date(dateStr).getDay()]} ${dateStr}${available ? `, ${availability?.items?.find(i => i.date === dateStr)?.available} cupos` : ", sin cupos"}`}
                >
                  {new Date(dateStr).getDate()}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Availability List */}
      {availability?.items && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fechas disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[40vh] overflow-y-auto">
              <div className="space-y-2">
                {availability.items
                  .filter((item) => !isPastDate(item.date))
                  .map((item) => {
                    const available = item.available > 0;
                    const selected = selectedDate === item.date;
                    return (
                      <button
                        key={item.date}
                        onClick={() => handleDayClick(item.date)}
                        disabled={!available}
                        className={cn(
                          "w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          !available && "opacity-50 cursor-not-allowed",
                          available && "hover:bg-accent cursor-pointer",
                          selected && "border-primary bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted"}`}>
                            {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                          </span>
                          <div>
                            <p className="font-medium">
                              {DIAS[new Date(item.date).getDay()]} {new Date(item.date).getDate()} de {MESES[new Date(item.date).getMonth()]}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)} · {item.available} cupos de {item.slotCapacity}
                            </p>
                          </div>
                        </div>
                        {available ? (
                          <Button variant={selected ? "default" : "outline"} size="sm" disabled={!available}>
                            {selected ? "Elegido" : "Elegir"}
                          </Button>
                        ) : (
                          <span className="text-xs text-destructive font-medium">Completo</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}