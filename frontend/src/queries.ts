import { queryOptions } from "@tanstack/react-query";
import { listBookings, listMeetingTypes, listMeetingTypeSlots } from "./api/generated/sdk.gen";

export const queryKeys = {
  types: ["meeting-types"],
  slots: ["meeting-slots"],
  bookings: ["bookings"],
} as const;

export const meetingTypesQuery = queryOptions({
  queryKey: queryKeys.types,
  queryFn: async ({ signal }) => (await listMeetingTypes({ signal, throwOnError: true })).data,
  staleTime: 30000,
  refetchOnWindowFocus: "always",
});

export function meetingSlotsQuery(id: string) {
  return queryOptions({
    queryKey: [...queryKeys.slots, id],
    queryFn: async ({ signal }) =>
      (await listMeetingTypeSlots({ path: { id }, signal, throwOnError: true })).data,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export const bookingsQuery = queryOptions({
  queryKey: queryKeys.bookings,
  queryFn: async ({ signal }) => (await listBookings({ signal, throwOnError: true })).data,
  staleTime: 0,
  refetchInterval: 60000,
  refetchIntervalInBackground: false,
});
