import * as Calendar from "expo-calendar";
import { Alert, Platform } from "react-native";
import { fetchBookingById } from "../services/api";

export const addBookingToCalendar = async ({ booking, address }) => {
  try {
    // STEP 1 — Check permission first
    let permission = await Calendar.getCalendarPermissionsAsync();

    if (permission.status !== "granted") {
      // STEP 2 — Ask permission
      permission = await Calendar.requestCalendarPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Calendar Permission Required",
          "Please allow calendar access to add bookings.",
        );
        return;
      }
    }

    // STEP 3 — Fetch calendars
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );

    if (!calendars?.length) {
      Alert.alert("No Calendar Found", "Please add a calendar account.");
      return;
    }

    const calendarId =
      calendars.find((c) => c.allowsModifications)?.id || calendars[0].id;

    const slotStart = booking?.services?.[0]?.slotStart;

    if (!slotStart) {
      Alert.alert("Slot Missing", "Booking slot not available.");
      return;
    }

    const startDate = new Date(slotStart);
    const endDate = new Date(startDate.getTime() + 75 * 60000);

    await Calendar.createEventAsync(calendarId, {
      title: `Qwiky Booking - ${booking.bookingCode}`,
      startDate,
      endDate,
      location: address || "",
      notes: `Booking ID: ${booking.bookingId}`,
      alarms: [{ relativeOffset: -30 }],
      attendees: CALENDAR_ATTENDEES.map((email) => ({ email })),
    });

    Alert.alert("Success", "Booking added to calendar");
  } catch (error) {
    console.error("Calendar Error:", error);
    Alert.alert("Calendar Error", "Failed to create calendar event.");
  }
};

export const resolveBookingAddress = async (booking) => {
  debugger;
  if (booking?.bookingAddress) {
    const a = booking.bookingAddress;

    return [
      a.addressLine1,
      a.addressLine2,
      a.locality,
      `${a.city}, ${a.state} ${a.pincode}`,
    ]
      .filter(Boolean)
      .join(", ");
  }

  // fallback fetch booking details
  const fullBooking = await fetchBookingById(booking.bookingId);

  const addr = fullBooking?.bookingAddress;

  if (!addr) return "";

  return [
    addr.addressLine1,
    addr.addressLine2,
    addr.locality,
    `${addr.city}, ${addr.state} ${addr.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");
};

export const CALENDAR_ATTENDEES = ["ankit.saini@qwiky.in"];
