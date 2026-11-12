import { useQueries, useQuery } from "@tanstack/react-query";
import { meetingSlotsQuery, meetingTypesQuery } from "./queries";
import type { MeetingType, SlotList } from "./api/generated/types.gen";

type AvailabilityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid" }
  | { status: "empty" }
  | { status: "ready"; type?: MeetingType; slots: SlotList; compatible: MeetingType[] };

export default function useAvailability(
  id: string,
  requestedStart: number | null,
  paused: boolean,
) {
  const choosingTime = requestedStart === null;
  const enabled = !paused;
  const catalogue = useQuery({
    ...meetingTypesQuery,
    enabled,
    staleTime: choosingTime ? meetingTypesQuery.staleTime : Infinity,
    refetchOnWindowFocus: choosingTime ? "always" : false,
    refetchOnReconnect: choosingTime,
  });
  const requested = (catalogue.data?.items ?? []).filter((type) => !id || type.id === id);
  const queries = useQueries({
    queries: requested.map((type) => ({
      ...meetingSlotsQuery(type.id),
      enabled,
      // A new selection always validates on mount. Keep an already checked
      // open form stable through field errors/focus; POST checks occupancy.
      staleTime: choosingTime ? 0 : Infinity,
      refetchOnWindowFocus: choosingTime,
      refetchOnReconnect: choosingTime,
    })),
  });
  const failure = catalogue.error ?? queries.find((query) => query.error)?.error;
  let state: AvailabilityState;
  if (enabled && (catalogue.isPending || queries.some((query) => query.isFetching))) {
    state = { status: "loading" };
  } else if (enabled && failure) {
    state = {
      status:
        typeof failure === "object" &&
        "code" in failure &&
        failure.code === "meeting_type_not_found"
          ? "invalid"
          : "error",
    };
  } else if (id && catalogue.data && !requested.length) {
    state = { status: "invalid" };
  } else if (catalogue.data && !requested.length) {
    state = { status: "empty" };
  } else if (
    !catalogue.data ||
    queries.some((query) => !query.data || (enabled && !query.isFetchedAfterMount))
  ) {
    // Cached slots alone must not validate a newly opened URL/selection.
    state = { status: "loading" };
  } else {
    const availability = requested.map((type, index) => ({ type, slots: queries[index]!.data! }));
    const occupied = [
      ...new Map(
        availability
          .flatMap(({ slots }) => slots.occupied ?? [])
          .map((interval) => [`${interval.startsAt}:${interval.endsAt}`, interval]),
      ).values(),
    ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const overlapsOccupied = (slot: SlotList["items"][number]) =>
      occupied.some(
        (interval) =>
          Date.parse(interval.startsAt) < Date.parse(slot.endsAt) &&
          Date.parse(slot.startsAt) < Date.parse(interval.endsAt),
      );
    const available = availability.map(({ type, slots }) => ({
      type,
      items: slots.items.filter((slot) => !overlapsOccupied(slot)),
    }));
    // Responses can straddle another booking: discard conflicting durations
    // before merging starts, so a longer stale slot cannot hide a valid short one.
    const unique = new Map(
      available.flatMap(({ items }) => items).map((slot) => [slot.startsAt, slot]),
    );
    state = {
      status: "ready",
      type: id ? requested[0] : undefined,
      slots: {
        ...availability[0]!.slots,
        items: [...unique.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        occupied,
      },
      compatible: available
        .filter(({ items }) => items.some((slot) => Date.parse(slot.startsAt) === requestedStart))
        .map(({ type }) => type),
    };
  }
  function refresh() {
    void catalogue.refetch();
    for (const query of queries) void query.refetch();
  }
  return { state, refresh };
}
