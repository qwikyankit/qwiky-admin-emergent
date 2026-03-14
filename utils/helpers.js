import { Linking } from 'react-native';
import { fetchUserDetails } from "../services/api";

const CALENDAR_EMAIL = 'support@qwiky.in';

const formatDateForCalendar = (date: Date) =>
  date.toISOString().replace(/-|:|\.\d+/g, '');

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

export const openCalendarEvent = async ({
  booking,
  user,
  address,
  phone,
  recordService,
  amount,
  mapLink,
}) => {

  const slotStart = booking?.services?.[0]?.slotStart;
  if (!slotStart) return;

  const start = new Date(slotStart);
  const end = new Date(start.getTime() + 75 * 60000);

  const startStr = formatDateForCalendar(start);
  const endStr = formatDateForCalendar(end);

  const slotTime = formatTime(start);

  const title = encodeURIComponent(
    `Qwiky | ${slotTime} | ${booking.bookingCode}`
  );

  const details = encodeURIComponent(
`Customer: ${user || 'N/A'}
Phone: ${phone || 'N/A'}

Amount: ₹${amount ?? '0'}

Record Service: ${recordService ? 'Yes' : 'No'}

Address:
${address || 'N/A'}

Google Maps:
${mapLink || 'N/A'}

Booking ID:
${booking?.bookingId || 'N/A'}`
  );

  const location = encodeURIComponent(address || '');

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${startStr}/${endStr}` +
    `&details=${details}` +
    `&location=${location}` +
    `&src=${CALENDAR_EMAIL}`;

  try {
    const supported = await Linking.canOpenURL(googleUrl);

    if (supported) {
      await Linking.openURL(googleUrl);
      return;
    }
  } catch (err) {
    console.log("Google calendar open failed, using ICS fallback");
  }

  // ---------- PWA / Mobile fallback using ICS ----------

  const formatICSDate = (date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const description =
`Customer: ${user || "N/A"}
Phone: ${phone || "N/A"}

Amount: ₹${amount ?? "0"}

Record Service: ${recordService ? "Yes" : "No"}

Address:
${address || "N/A"}

Google Maps:
${mapLink || "N/A"}

Booking ID:
${booking?.bookingId || "N/A"}`;

  const icsContent =
`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Qwiky | ${slotTime} | ${booking.bookingCode}
DESCRIPTION:${description.replace(/\n/g, "\\n")}
LOCATION:${address || ""}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
END:VEVENT
END:VCALENDAR`;

  const icsUrl =
    "data:text/calendar;charset=utf8," +
    encodeURIComponent(icsContent);

  await Linking.openURL(icsUrl);
};

export const createCalendarEvent = async ({
  booking,
  getAddress,
  getGoogleMapLink,
  getAmount,
  getServiceRecordConsent
}) => {

  let customerName =
    booking?.userName ||
    booking?.customerName ||
    null;

  let phone =
    booking?.phone ||
    booking?.mobileNumber ||
    null;

  /**
   * Fetch user details if missing
   */
  if ((!customerName || !phone) && booking?.userId) {
    try {

      const user = await fetchUserDetails(booking.userId);

      customerName =
        user?.name ||
        user?.fullName ||
        user?.userName ||
        customerName;

      phone =
        user?.mobileNumber
          ? `+${user?.countryCode || '91'} ${user.mobileNumber}`
          : user?.phone ||
            user?.phoneNumber ||
            phone;

    } catch (e) {
      console.log("User fetch failed", e);
    }
  }

  const address = getAddress?.() || '';

  const mapLink = getGoogleMapLink?.() || '';

  const amount = getAmount?.() ?? 0;

  const recordService =
    getServiceRecordConsent?.() === 'true';

  await openCalendarEvent({
    booking,
    user: customerName,
    phone,
    address,
    mapLink,
    amount,
    recordService
  });
};

export const getBookingCalendarDetails = ({
  booking,
  user,
  getAddress,
  getUserPhone,
  getGoogleMapLink,
  getAmount,
  getServiceRecordConsent
}) => {

  return {
    userName:
      user?.name ||
      user?.fullName ||
      booking?.userName ||
      null,

    phone:
      getUserPhone?.() ||
      booking?.phone ||
      null,

    address:
      getAddress?.() || '',

    mapLink:
      getGoogleMapLink?.() || '',

    amount:
      getAmount?.() ?? 0,

    recordService:
      getServiceRecordConsent?.() === 'true'
  };
};