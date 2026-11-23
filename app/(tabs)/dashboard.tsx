import { router, useFocusEffect } from "expo-router";
import { Button, Card, Chip, Input, Text, cn } from "panelui-native";
import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { createPlanningService } from "../../src/application/planning-service";
import {
  estimatedSeconds,
  formatDuration,
  type CapacityViewModel,
  type RecommendationResult,
} from "../../src/domain";
import { CapacityMeter } from "../../src/features/dashboard/capacity-meter";
import {
  capacityProjection,
  presentCapacity,
} from "../../src/features/dashboard/capacity-presenter";
import {
  availableMinuteShortcuts,
  parseAvailableMinutes,
} from "../../src/features/dashboard/recommendation-presenter";
import { readingRouteParams } from "../../src/features/materials/material-presenter";
import { openNativeRepositories } from "../../src/storage/sqlite/expo-sqlite-adapter";
import type { Material } from "../../src/types";

export default function DashboardScreen() {
  const [capacity, setCapacity] = useState<CapacityViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] =
    useState<RecommendationResult | null>(null);
  const [availableMinutes, setAvailableMinutes] = useState(15);
  const [showCustom, setShowCustom] = useState(false);
  const [usingCustom, setUsingCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualSelection, setManualSelection] = useState<Material | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const manualRequest = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setError(null);
      openNativeRepositories()
        .then(async (repositories) => {
          const service = createPlanningService({ repositories });
          const [nextCapacity, nextRecommendation] = await Promise.all([
            service.getCapacity(),
            service.recommend(availableMinutes * 60),
          ]);
          if (!mounted) return;
          setCapacity(nextCapacity);
          setRecommendation(nextRecommendation);
          setManualSelection((previous) =>
            previous
              ? (nextRecommendation.manual.find(
                  (item) => item.id === previous.id,
                ) ?? null)
              : null,
          );
        })
        .catch(() => {
          if (!mounted) return;
          setRecommendation(null);
          setManualSelection(null);
          setError("Could not load the plan. Reopen this tab to retry.");
        });
      return () => {
        mounted = false;
        manualRequest.current++;
      };
    }, [availableMinutes]),
  );

  function chooseAvailableMinutes(minutes: number) {
    manualRequest.current++;
    setManualError(null);
    if (availableMinutes !== minutes) setRecommendation(null);
    setAvailableMinutes(minutes);
    setCustomError(null);
    setShowManual(false);
    setManualSelection(null);
  }

  function applyCustomMinutes() {
    const minutes = parseAvailableMinutes(customMinutes);
    if (minutes === null) {
      setCustomError("Enter a whole number of minutes.");
      return;
    }
    setUsingCustom(true);
    chooseAvailableMinutes(minutes);
  }

  async function selectManual(materialId: string) {
    const request = ++manualRequest.current;
    setManualError(null);
    try {
      const repositories = await openNativeRepositories();
      const { material } = await createPlanningService({
        repositories,
      }).selectManual(materialId);
      if (manualRequest.current !== request) return;
      setManualSelection(material);
      setShowManual(false);
    } catch {
      if (manualRequest.current === request)
        setManualError("That item is no longer available.");
    }
  }

  const presentation = capacity ? presentCapacity(capacity) : null;
  const projection = capacity ? capacityProjection(capacity) : null;
  const selection = manualSelection ?? recommendation?.primary ?? null;
  const partial = recommendation?.partial;
  const choices = recommendation?.manual ?? [];

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
              Your reading plan
            </Text>
          </View>

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-destructive-foreground"
            >
              {error}
            </Text>
          ) : null}
          {presentation ? (
            <Card className="gap-3 p-4">
              <Text accessibilityRole="header" size="lg" weight="semibold">
                Time available this week
              </Text>
              <Text weight="bold" className="text-3xl tracking-tight">
                {presentation.message}
              </Text>
              <CapacityMeter
                tone={presentation.tone}
                value={presentation.meterValue}
                valueText={presentation.message}
              />
              <Text className="text-muted-foreground">
                {presentation.detail}
              </Text>
              {projection ? (
                <Text className="text-muted-foreground">{projection}</Text>
              ) : null}
              {capacity?.capacitySeconds === null ||
              capacity?.capacitySeconds === 0 ? (
                <Button
                  variant="outline"
                  onPress={() => router.navigate("/settings")}
                >
                  Set weekly availability
                </Button>
              ) : null}
            </Card>
          ) : !error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-muted-foreground"
            >
              Loading your plan…
            </Text>
          ) : null}

          {capacity ? (
            <View className="gap-3">
              <View className="gap-1">
                <Text accessibilityRole="header" size="2xl" weight="bold">
                  Read next
                </Text>
                <Text className="text-muted-foreground">
                  How much time do you have?
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {availableMinuteShortcuts.map((minutes) => {
                  const selected = !usingCustom && availableMinutes === minutes;
                  return (
                    <Chip
                      key={minutes}
                      className={cn(
                        "h-auto min-h-12 grow justify-center rounded-xl py-2",
                        selected && "bg-primary",
                      )}
                      labelClassName={
                        selected ? "text-primary-foreground" : undefined
                      }
                      variant="outline"
                      selected={selected}
                      onPress={() => {
                        setShowCustom(false);
                        setUsingCustom(false);
                        chooseAvailableMinutes(minutes);
                      }}
                    >
                      {`${minutes} min`}
                    </Chip>
                  );
                })}
                <Button
                  className="min-h-12 grow rounded-xl"
                  variant={usingCustom ? "primary" : "outline"}
                  accessibilityState={{
                    expanded: showCustom,
                    selected: usingCustom,
                  }}
                  onPress={() => {
                    setShowCustom(!showCustom);
                    setCustomError(null);
                  }}
                >
                  Custom
                </Button>
              </View>
              {showCustom ? (
                <View className="flex-row flex-wrap items-start gap-2">
                  <Input
                    accessibilityLabel="Available minutes"
                    containerClassName="min-w-32 flex-1"
                    size="lg"
                    keyboardType="number-pad"
                    onChangeText={setCustomMinutes}
                    onSubmitEditing={applyCustomMinutes}
                    placeholder="Minutes"
                    value={customMinutes}
                    errorMessage={customError ?? undefined}
                  />
                  <Button
                    size="lg"
                    variant="outline"
                    onPress={applyCustomMinutes}
                  >
                    Use time
                  </Button>
                </View>
              ) : null}

              {selection ? (
                <Card className="gap-2 p-4">
                  <Text size="xl" weight="semibold">
                    {selection.title}
                  </Text>
                  <Text className="text-muted-foreground">
                    {materialSummary(selection)}
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <Button
                      className="grow"
                      onPress={() =>
                        router.push({
                          pathname: "/reading",
                          params: readingRouteParams(selection),
                        })
                      }
                    >
                      Open source
                    </Button>
                    {choices.length > 1 ? (
                      <Button
                        variant="ghost"
                        accessibilityState={{ expanded: showManual }}
                        onPress={() => setShowManual(!showManual)}
                      >
                        {showManual ? "Hide choices" : "Choose another"}
                      </Button>
                    ) : null}
                  </View>
                </Card>
              ) : recommendation ? (
                <Card className="gap-2 p-4">
                  <Text size="xl" weight="semibold">
                    {choices.length > 0
                      ? `Nothing fits in ${availableMinutes} min`
                      : "Your reading plan is empty"}
                  </Text>
                  {partial ? (
                    <Button
                      variant="outline"
                      onPress={() => void selectManual(partial.id)}
                    >
                      Choose longer item
                    </Button>
                  ) : null}
                  {choices.length > 0 ? (
                    <Button
                      variant="ghost"
                      accessibilityState={{ expanded: showManual }}
                      onPress={() => setShowManual(!showManual)}
                    >
                      {showManual ? "Hide choices" : "Choose another"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onPress={() => router.navigate("/")}
                    >
                      Save a link
                    </Button>
                  )}
                </Card>
              ) : !error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-muted-foreground"
                >
                  Finding a match…
                </Text>
              ) : null}

              {manualError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-destructive-foreground"
                >
                  {manualError}
                </Text>
              ) : null}
              {showManual ? (
                <View className="gap-2">
                  {choices
                    .filter((item) => item.id !== selection?.id)
                    .map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="justify-start"
                        onPress={() => void selectManual(item.id)}
                      >
                        {`${item.title} · ${materialSummary(item)}`}
                      </Button>
                    ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function materialSummary(material: Material) {
  const type =
    material.type === "article"
      ? "Article"
      : material.type === "video"
        ? "Video"
        : "Link";
  return `${type} · ${formatDuration(estimatedSeconds(material))}`;
}
