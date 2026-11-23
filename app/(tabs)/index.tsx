import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Input, RadioGroup, Text } from "panelui-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";

import { createCaptureService } from "../../src/application/capture-service";
import type { CaptureDestination } from "../../src/application/capture-service";
import { openNativeRepositories } from "../../src/storage/sqlite/expo-sqlite-adapter";
import type { NativeRepositories } from "../../src/storage/sqlite/repositories";

export default function HomeScreen() {
  const { intakeId, shareError } = useLocalSearchParams<{
    intakeId?: string | string[];
    shareError?: string | string[];
  }>();
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState<CaptureDestination>("queued");
  const [stagedIntakeId, setStagedIntakeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<CaptureDestination | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((nextRepositories) => {
        if (mounted) setRepositories(nextRepositories);
      })
      .catch(() => {
        if (mounted)
          setDatabaseError(
            "Local storage is unavailable. Reopen the app to retry.",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const nextIntakeId = Array.isArray(intakeId) ? intakeId[0] : intakeId;
    const nextShareError = Array.isArray(shareError)
      ? shareError[0]
      : shareError;
    if (
      nextShareError === "unavailable" ||
      nextShareError === "ios-unsupported"
    ) {
      setSavedTo(null);
      setStatus(
        nextShareError === "ios-unsupported"
          ? "Sharing is unavailable on iOS in this build. Paste the link below."
          : "Could not open the share. Paste the link below.",
      );
    }
    if (!repositories || !nextIntakeId) return;

    let mounted = true;
    repositories.captureIntake
      .get(nextIntakeId)
      .then((intake) => {
        if (!mounted) return;
        if (!intake || intake.consumedAt !== null) {
          setStatus("That share has expired. Paste the link below.");
          return;
        }
        setUrl(intake.url);
        setStagedIntakeId(intake.id);
        setDestination("queued");
        setSavedTo(null);
        setStatus("Shared link ready to save.");
      })
      .catch(() => {
        if (mounted)
          setStatus("Could not load the share. Paste the link below.");
      });
    return () => {
      mounted = false;
    };
  }, [intakeId, repositories, shareError]);

  const captureService = useMemo(
    () =>
      repositories
        ? createCaptureService({
            repositories,
            generateId: randomUUID,
            now: () => new Date().toISOString(),
          })
        : null,
    [repositories],
  );

  function showSaved(savedDestination: CaptureDestination) {
    setUrl("");
    setStagedIntakeId(null);
    setDestination("queued");
    setSavedTo(savedDestination);
  }

  async function saveCapture() {
    if (isSaving || !captureService) return;
    if (!url.trim()) {
      setStatus("Paste an HTTP(S) link to continue.");
      return;
    }
    setIsSaving(true);
    setSavedTo(null);
    setStatus(null);
    try {
      const result = stagedIntakeId
        ? await captureService.captureStagedIntake(stagedIntakeId, destination)
        : await captureService.captureUrl(url, destination);
      if (result.kind === "duplicate") {
        Alert.alert(
          "Link already saved",
          `Save another copy of “${result.existing.title}”?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save another",
              onPress: () => {
                setIsSaving(true);
                setStatus(null);
                void result
                  .retry()
                  .then((retryResult) => {
                    if (retryResult.kind !== "saved") {
                      setStatus("That link could not be saved again.");
                      return;
                    }
                    showSaved(destination);
                  })
                  .catch((retryError) => {
                    setStatus(
                      retryError instanceof Error
                        ? retryError.message
                        : "That link could not be saved again.",
                    );
                  })
                  .finally(() => setIsSaving(false));
              },
            },
          ],
        );
      } else {
        showSaved(destination);
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "That link could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="mx-auto w-full max-w-lg gap-6 px-5 py-6">
          <View className="gap-2">
            <Text weight="bold" className="text-primary">
              stop-tumpuk
            </Text>
            <Text
              accessibilityRole="header"
              weight="bold"
              className="text-4xl tracking-tight"
            >
              Save a link
            </Text>
            <Text className="text-muted-foreground">
              Add an article or video to read later.
            </Text>
          </View>

          <Input
            label="Link"
            size="lg"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={isSaving}
            keyboardType="url"
            onChangeText={(value) => {
              setUrl(value);
              setSavedTo(null);
              setStatus(null);
            }}
            onSubmitEditing={() => void saveCapture()}
            placeholder="https://example.com"
            returnKeyType="done"
            value={url}
          />

          <View className="gap-2">
            <Text weight="semibold">Save to</Text>
            <RadioGroup
              accessibilityLabel="Save to"
              disabled={isSaving}
              value={destination}
              variant="card"
              onValueChange={(value) => {
                if (value === "queued" || value === "inbox")
                  setDestination(value);
              }}
            >
              <RadioGroup.Item
                className={destination === "queued" ? "bg-accent" : "bg-card"}
                value="queued"
                label="Reading plan"
                description="Counts toward planned time"
              />
              <RadioGroup.Item
                className={destination === "inbox" ? "bg-accent" : "bg-card"}
                value="inbox"
                label="Save for later"
                description="Keep it outside the plan"
              />
            </RadioGroup>
          </View>

          <Button
            size="lg"
            fullWidth
            disabled={!repositories}
            loading={isSaving}
            onPress={() => void saveCapture()}
          >
            {destination === "queued"
              ? "Save to Reading plan"
              : "Save for later"}
          </Button>

          {savedTo ? (
            <Card className="flex-row flex-wrap items-center justify-between gap-2 border-primary p-3">
              <Text
                accessibilityLiveRegion="polite"
                weight="semibold"
                className="text-primary"
              >
                {savedTo === "queued"
                  ? "Saved to Reading plan"
                  : "Saved for later"}
              </Text>
              <Button
                variant="ghost"
                onPress={() =>
                  router.navigate(
                    savedTo === "queued" ? "/dashboard" : "/later",
                  )
                }
              >
                {savedTo === "queued" ? "View plan →" : "View later →"}
              </Button>
            </Card>
          ) : null}
          {status ? (
            <Text accessibilityLiveRegion="polite">{status}</Text>
          ) : null}
          {databaseError ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-destructive-foreground"
            >
              {databaseError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
