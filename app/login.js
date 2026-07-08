import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { requestOtp, verifyOtp, getFriendlyError } from "../services/api";
import THEME from "../constants/theme";

export default function Login() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!seconds) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const handleRequestOtp = async () => {
    setError("");
    if (mobile.length !== 10) {
      setError("Please enter a valid 10 digit mobile number.");
      return;
    }

    try {
      setLoading(true);
      await requestOtp(mobile);
      setOtpRequested(true);
      setSeconds(30);
    } catch (e) {
      setError(e?.friendlyMessage || "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (!otp) {
      setError("Please enter the OTP.");
      return;
    }
    try {
      setLoading(true);
      await verifyOtp(mobile, otp);
      router.replace("/");
    } catch (e) {
      setError(getFriendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Qwiky Admin</Text>
        <Text style={styles.subtitle}>OTP Login</Text>
        <TextInput
          style={[styles.input, otpRequested && styles.inputDisabled]}
          placeholder="Mobile Number"
          keyboardType="number-pad"
          maxLength={10}
          editable={!otpRequested}
          value={mobile}
          onChangeText={setMobile}
        />

        {otpRequested && (
          <>
            <View style={{ height: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />

            <TouchableOpacity disabled={seconds > 0} onPress={handleRequestOtp}>
              <Text style={styles.resend}>
                {seconds ? `Resend OTP in ${seconds}s` : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.button}
          disabled={loading}
          onPress={otpRequested ? handleVerifyOtp : handleRequestOtp}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {otpRequested ? "Login" : "Request OTP"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F7FB",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFF",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 36,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 6,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    color: THEME.colors.primary,
    textAlign: "center",
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 34,
    textAlign: "center",
    color: "#7A7A7A",
    fontSize: 18,
    fontWeight: "500",
  },

  input: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 18,
    fontSize: 18,
    color: "#111827",
    marginBottom: 18,
  },

  resend: {
    alignSelf: "flex-end",
    marginBottom: 24,
    color: THEME.colors.primary,
    fontWeight: "700",
    fontSize: 16,
  },

  button: {
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.colors.primary,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 18,
  },
  errorText: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    color: "#DC2626",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  inputDisabled: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
  },
});
