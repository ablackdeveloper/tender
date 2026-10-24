import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/theme/theme-provider";

export function localCalendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function CalendarField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selected = value ? new Date(`${value}T12:00:00`) : null;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Button
        variant="secondary"
        accessibilityLabel={label}
        onPress={() => {
          setMonth(selected ?? new Date());
          setVisible(true);
        }}
      >
        {selected
          ? selected.toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Choose a date"}
      </Button>
      <Sheet title={label} visible={visible} onClose={() => setVisible(false)}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs }}
        >
          <Button
            variant="ghost"
            accessibilityLabel="Previous month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            ‹
          </Button>
          <AppText style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </AppText>
          <Button
            variant="ghost"
            accessibilityLabel="Next month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            ›
          </Button>
        </View>
        <ScrollView horizontal>
          <View
            style={{
              width: theme.sizes.minimumTarget * 7,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <View key={day} style={{ width: "14.2857%", alignItems: "center" }}>
                <AppText color="muted" variant="caption">
                  {day}
                </AppText>
              </View>
            ))}
            {Array.from({ length: first.getDay() }, (_, i) => (
              <View key={`space-${i}`} style={{ width: "14.2857%" }} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
              const key = localCalendarDate(date);
              return (
                <View key={key} style={{ width: "14.2857%", alignItems: "center" }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    accessibilityState={{ selected: key === value }}
                    onPress={() => {
                      onChange(key);
                      setVisible(false);
                    }}
                    style={{
                      minHeight: theme.sizes.minimumTarget,
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: theme.radii.compact,
                      backgroundColor:
                        key === value ? theme.colors.primary : theme.colors.surface,
                    }}
                  >
                    <AppText
                      style={{
                        color:
                          key === value ? theme.colors.onPrimary : theme.colors.text,
                      }}
                    >
                      {i + 1}
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
        {optional ? (
          <Button
            variant="ghost"
            onPress={() => {
              onChange("");
              setVisible(false);
            }}
          >
            Leave date unset
          </Button>
        ) : null}
      </Sheet>
    </View>
  );
}

export function AppointmentDateTimeField({
  value,
  onChange,
  onValidityChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const { theme } = useTheme();
  const date = new Date(value);
  const [hour, setHour] = useState(String(date.getHours()).padStart(2, "0"));
  const [minute, setMinute] = useState(String(date.getMinutes()).padStart(2, "0"));
  const valid =
    /^\d{1,2}$/.test(hour) &&
    Number(hour) < 24 &&
    /^\d{1,2}$/.test(minute) &&
    Number(minute) < 60;
  const changeTime = (h: string, m: string) => {
    setHour(h);
    setMinute(m);
    onValidityChange(
      /^\d{1,2}$/.test(h) && Number(h) < 24 && /^\d{1,2}$/.test(m) && Number(m) < 60,
    );
    if (
      /^\d{1,2}$/.test(h) &&
      Number(h) < 24 &&
      /^\d{1,2}$/.test(m) &&
      Number(m) < 60
    ) {
      const next = new Date(value);
      next.setHours(Number(h), Number(m), 0, 0);
      onChange(next.toISOString());
    }
  };
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <CalendarField
        label="Appointment date"
        value={localCalendarDate(date)}
        onChange={(day) => {
          const next = new Date(`${day}T12:00:00`);
          next.setHours(Number(hour), Number(minute), 0, 0);
          if (!Number.isNaN(next.getTime())) onChange(next.toISOString());
        }}
      />
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Hour (0–23)"
            keyboardType="number-pad"
            maxLength={2}
            value={hour}
            onChangeText={(h) => changeTime(h, minute)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Minute (0–59)"
            keyboardType="number-pad"
            maxLength={2}
            value={minute}
            onChangeText={(m) => changeTime(hour, m)}
          />
        </View>
      </View>
      <AppText color={valid ? "muted" : "danger"}>
        {valid
          ? `Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
          : "Enter an hour from 0 to 23 and a minute from 0 to 59."}
      </AppText>
    </View>
  );
}
