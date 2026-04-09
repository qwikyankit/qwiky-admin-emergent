import { useState } from "react";
import { Platform } from "react-native";

export const useDateRangePicker = () => {
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [webVisible, setWebVisible] = useState(false);

  const openPicker = (type) => {
    if (Platform.OS === "web") {
      setWebVisible(true);
      return;
    }

    setPickerType(type);
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (!selectedDate) return;

    if (pickerType === "start") {
      setCustomStartDate(selectedDate);

      if (customEndDate && selectedDate > customEndDate) {
        setCustomEndDate(selectedDate);
      }
    } else {
      setCustomEndDate(selectedDate);

      if (customStartDate && selectedDate < customStartDate) {
        setCustomStartDate(selectedDate);
      }
    }
  };

  const applyWebDates = (start, end, showToast) => {
    if (!start) return false;

    let finalEnd = end || new Date();

    if (start > finalEnd) {
      showToast("Start date cannot be greater than end date", "error");
      return false;
    }

    setCustomStartDate(start);
    setCustomEndDate(finalEnd);
    setWebVisible(false);

    return true;
  };

  return {
    customStartDate,
    customEndDate,
    setCustomStartDate, // ✅ ADD THIS
    setCustomEndDate, // ✅ ADD THIS
    showDatePicker,
    pickerType,
    webVisible,
    setWebVisible,
    openPicker,
    onDateChange,
    applyWebDates,
  };
};
