"use client";
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface AppointmentEvent {
  type: "APPOINTMENT_STATUS_CHANGED" | "APPOINTMENT_CREATED" | "APPOINTMENT_OBSERVATION_ADDED" | "CONNECTED";
  payload: {
    appointmentId?: string;
    patientId?: string;
    doctorId?: string;
    scheduleId?: string;
    status?: string;
    previousStatus?: string;
    date?: string;
    position?: number;
  };
  timestamp: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = API_URL.replace(/^http/, "ws");

export function useAppointmentWebSocket(doctorId: string | undefined, date: string | undefined) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const handleMessage = useCallback((event: MessageEvent) => {
    console.log("[WebSocket] Received message:", event.data);
    try {
      const data: AppointmentEvent = JSON.parse(event.data);
      console.log("[WebSocket] Parsed:", data);

      switch (data.type) {
        case "APPOINTMENT_STATUS_CHANGED": {
          if (data.payload.appointmentId && data.payload.status) {
            console.log("[WebSocket] Updating cache for appointment:", data.payload.appointmentId, "to status:", data.payload.status);
            
            // Log current cache
            const queryKey = date ? ["agenda-doctor", date] : ["agenda-doctor"];
            const currentCache = queryClient.getQueryData(queryKey);
            console.log("[WebSocket] Current cache:", JSON.stringify(currentCache, null, 2));
            
            queryClient.setQueryData<{ items: unknown[] }>(
              queryKey,
              (old) => {
                if (!old) {
                  console.log("[WebSocket] Cache is empty/null for key:", queryKey);
                  return old;
                }
                console.log("[WebSocket] Processing cache items:", old.items?.length);
                return {
                  ...old,
                  items: old.items.map((horario: unknown) => {
                    const h = horario as { appointments?: Array<{ id: string; status: string }> };
                    if (!h.appointments) {
                      console.log("[WebSocket] No appointments in schedule:", h);
                      return h;
                    }
                    console.log("[WebSocket] Checking appointments in schedule:", h.appointments.map(a => a.id));
                    return {
                      ...h,
                      appointments: h.appointments.map((appt) =>
                        appt.id === data.payload.appointmentId
                          ? { ...appt, status: data.payload.status }
                          : appt
                      ),
                    };
                  }),
                };
              }
            );
            
            // Verify update
            const updatedCache = queryClient.getQueryData(queryKey);
            console.log("[WebSocket] Updated cache:", JSON.stringify(updatedCache, null, 2));
            
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }
          break;
        }
        case "APPOINTMENT_CREATED": {
          const queryKey = date ? ["agenda-doctor", date] : ["agenda-doctor"];
          queryClient.invalidateQueries({ queryKey: queryKey });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          break;
        }
        case "APPOINTMENT_OBSERVATION_ADDED": {
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          break;
        }
        case "CONNECTED": {
          console.log("[WebSocket] Connected to appointment updates for doctor:", data.payload.doctorId);
          reconnectAttempts.current = 0;
          break;
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", error);
    }
  }, [queryClient, date]);

  const connect = useCallback(() => {
    if (!doctorId) return;

    console.log("[WebSocket] All cookies:", document.cookie);
    console.log("[WebSocket] mc_at_ws cookie:", document.cookie.split("; ").find((row) => row.startsWith("mc_at_ws=")));

    let token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("mc_at_ws="))
      ?.split("=")[1];

    if (!token) {
      console.warn("[WebSocket] No auth token found in mc_at_ws, trying mc_at...");
      const fallbackToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("mc_at="))
        ?.split("=")[1];
      if (!fallbackToken) {
        console.warn("[WebSocket] No auth token found at all");
        return;
      }
      console.log("[WebSocket] Using fallback mc_at token");
      token = fallbackToken;
    }

    const ws = new WebSocket(`${WS_URL}/api/v1/ws/appointments?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      console.log("[WebSocket] Connection opened");
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log("[WebSocket] Connection closed:", event.code, event.reason);
      wsRef.current = null;

      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    wsRef.current = ws;
  }, [doctorId, handleMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}