import { randomUUID } from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Text as PanelText,
} from "panelui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createLifecycleService } from "../../application/lifecycle-service";
import { createNotesService } from "../../application/notes-service";
import {
  createMaterialManagementService,
  searchMaterials,
  type MaterialEdit,
  type MaterialListFilter,
} from "../../application/material-management-service";
import {
  actionGroupForStatus,
  actionLabel,
  materialFilters,
  readingRouteParams,
  type MaterialAction,
} from "./material-presenter";
import { estimatedSeconds, formatDuration } from "../../domain";
import { openNativeRepositories } from "../../storage/sqlite/expo-sqlite-adapter";
import type { NativeRepositories } from "../../storage/sqlite/repositories";
import type { Material, MaterialType, Note } from "../../types";

const colors = {
  ink: "#17211B",
  muted: "#647067",
  paper: "#F6F7F2",
  panel: "#FFFFFF",
  line: "#DDE4DC",
  accent: "#2E6B4D",
  accentSoft: "#E5F0E7",
  danger: "#A53D32",
};

export default function MaterialsScreen({
  laterOnly = false,
}: {
  laterOnly?: boolean;
}) {
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [materials, setMaterials] = useState<Material[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<MaterialListFilter>("all");
  const filter = laterOnly ? "inbox" : libraryFilter;
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!repositories) return;
    setLoading(true);
    try {
      setMaterials(
        await createMaterialManagementService({
          repositories,
          now: () => new Date().toISOString(),
        }).list(),
      );
    } catch {
      setMessage("The material list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [repositories]);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((nextRepositories) => {
        if (mounted) setRepositories(nextRepositories);
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
          setMessage("Local storage is unavailable. Try reopening the app.");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (repositories) void load();
    }, [load, repositories]),
  );

  const visibleMaterials = useMemo(
    () => searchMaterials(materials, filter, query),
    [filter, materials, query],
  );

  async function performAction(material: Material, action: MaterialAction) {
    if (!repositories) return;
    setMessage(null);
    try {
      if (action === "open") {
        router.push({
          pathname: "/reading",
          params: readingRouteParams(material),
        });
        return;
      }
      if (action === "edit") {
        setEditing(material);
        setExpandedId(null);
        return;
      }
      if (action === "delete") {
        Alert.alert(
          "Delete material?",
          `This removes “${material.title}” and its local history. This cannot be undone.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => void confirmDelete(material),
            },
          ],
        );
        return;
      }
      const lifecycle = createLifecycleService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      });
      const next = {
        commit: () => lifecycle.commit(material.id),
        start: () => lifecycle.start(material.id),
        finish: () => lifecycle.finish(material.id),
        reopen: () => lifecycle.reopen(material.id),
        "return-to-inbox": () => lifecycle.returnToInbox(material.id),
        archive: () => lifecycle.archive(material.id),
      }[action as Exclude<MaterialAction, "open" | "edit" | "delete">];
      if (!next) return;
      await next();
      await load();
      setExpandedId(null);
      const confirmation =
        action === "commit"
          ? "Added to Reading plan."
          : action === "return-to-inbox"
            ? "Moved to Later."
            : "Material updated.";
      setMessage(confirmation);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function confirmDelete(material: Material) {
    if (!repositories) return;
    try {
      await createLifecycleService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      }).delete(material.id);
      await load();
      setExpandedId(null);
      setMessage("Material deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function saveEdit(draft: MaterialEdit) {
    if (!repositories || !editing) return;
    try {
      await createMaterialManagementService({
        repositories,
        now: () => new Date().toISOString(),
      }).edit(editing.id, draft);
      await load();
      setEditing(null);
      setMessage("Material updated.");
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Material could not be updated.");
    }
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-lg gap-4 px-5 py-6">
          <View className="gap-2">
            <PanelText weight="bold" className="text-primary">
              stop-tumpuk
            </PanelText>
            <PanelText
              accessibilityRole="header"
              weight="bold"
              className="text-4xl tracking-tight"
            >
              {laterOnly ? "Later" : "Library"}
            </PanelText>
          </View>

          <Input
            accessibilityLabel={laterOnly ? "Search Later" : "Search Library"}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={laterOnly ? "Search Later" : "Search Library"}
            size="lg"
            value={query}
          />

          {!laterOnly ? (
            <View className="flex-row flex-wrap gap-2">
              {materialFilters.map((item) => (
                <Chip
                  key={item.key}
                  className="h-auto min-h-12 py-2"
                  variant="outline"
                  selected={libraryFilter === item.key}
                  onPress={() => {
                    setLibraryFilter(item.key);
                    setExpandedId(null);
                  }}
                >
                  {item.label}
                </Chip>
              ))}
            </View>
          ) : null}

          {message ? (
            <PanelText accessibilityLiveRegion="polite">{message}</PanelText>
          ) : null}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <PanelText className="text-muted-foreground">
                Loading saved links…
              </PanelText>
            </View>
          ) : visibleMaterials.length === 0 ? (
            <EmptyState variant="card" size="sm">
              <EmptyState.Header>
                <EmptyState.Title>
                  {query.trim() ? "No matches" : emptyTitle(filter)}
                </EmptyState.Title>
                <EmptyState.Description>
                  {query.trim()
                    ? "Try another title, domain, or URL."
                    : emptyDescription(filter)}
                </EmptyState.Description>
              </EmptyState.Header>
              {!query.trim() && (filter === "inbox" || filter === "all") ? (
                <EmptyState.Content>
                  <Button
                    variant="outline"
                    onPress={() => router.navigate("/")}
                  >
                    Save a link
                  </Button>
                </EmptyState.Content>
              ) : null}
            </EmptyState>
          ) : (
            <View style={styles.list}>
              {visibleMaterials.map((material) => (
                <MaterialCard
                  expanded={expandedId === material.id}
                  key={material.id}
                  material={material}
                  repositories={repositories!}
                  onAction={(action) => void performAction(material, action)}
                  onToggleAdvanced={() =>
                    setExpandedId((current) =>
                      current === material.id ? null : material.id,
                    )
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <EditMaterialModal
        material={editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
    </>
  );
}

function MaterialCard({
  expanded,
  material,
  repositories,
  onAction,
  onToggleAdvanced,
}: {
  expanded: boolean;
  material: Material;
  repositories: NativeRepositories;
  onAction: (action: MaterialAction) => void;
  onToggleAdvanced: () => void;
}) {
  const actions = actionGroupForStatus(material.status);
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <PanelText size="sm" weight="semibold" className="text-primary">
          {typeLabel(material.type)}
        </PanelText>
        <PanelText size="sm" className="text-muted-foreground">
          {formatDuration(estimatedSeconds(material))}
        </PanelText>
      </View>
      <PanelText size="lg" weight="bold">
        {material.title}
      </PanelText>
      <PanelText size="sm" numberOfLines={1} className="text-muted-foreground">
        {material.domain}
      </PanelText>
      <NotesPanel material={material} repositories={repositories} />
      <View className="flex-row flex-wrap items-center gap-2">
        <Button className="grow" onPress={() => onAction(actions.primary)}>
          {actionLabel(actions.primary)}
        </Button>
        <Button
          accessibilityLabel={`Advanced actions for ${material.title}`}
          accessibilityState={{ expanded }}
          variant="outline"
          onPress={onToggleAdvanced}
        >
          {expanded ? "Close" : "Advanced actions"}
        </Button>
      </View>
      {expanded ? (
        <View
          accessibilityLabel="Advanced actions"
          style={styles.advancedPanel}
        >
          {actions.advanced.map((action) => (
            <Pressable
              accessibilityRole="button"
              key={action}
              onPress={() => onAction(action)}
              style={({ pressed }) => [
                styles.advancedAction,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.advancedActionText,
                  action === "delete" && styles.dangerText,
                ]}
              >
                {actionLabel(action)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function NotesPanel({
  material,
  repositories,
}: {
  material: Material;
  repositories: NativeRepositories;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNotes() {
    setLoading(true);
    setError(null);
    try {
      const service = createNotesService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      });
      setNotes(await service.search(query, material.id));
    } catch {
      setError("Notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
    // The query and material ID intentionally trigger a fresh repository read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id, query, repositories]);

  function openNewNote() {
    setEditing(null);
    setDraft("");
    setEditorOpen(true);
  }

  function openEditNote(note: Note) {
    setEditing(note);
    setDraft(note.content);
    setEditorOpen(true);
  }

  async function saveNote() {
    try {
      const service = createNotesService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      });
      if (editing) {
        await service.update(editing.id, draft);
      } else {
        await service.create(material.id, draft);
      }
      setEditorOpen(false);
      await loadNotes();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Note could not be saved.",
      );
    }
  }

  function confirmDelete(note: Note) {
    Alert.alert("Delete note?", "This note will be removed permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteNote(note),
      },
    ]);
  }

  async function deleteNote(note: Note) {
    try {
      await createNotesService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      }).delete(note.id);
      await loadNotes();
    } catch {
      setError("Note could not be deleted.");
    }
  }

  return (
    <View style={styles.notesPanel}>
      <View style={styles.notesHeader}>
        <Text style={styles.notesTitle}>Notes</Text>
        <Pressable
          accessibilityRole="button"
          onPress={openNewNote}
          style={({ pressed }) => [
            styles.newNoteButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.newNoteText}>New note</Text>
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel={`Search notes for ${material.title}`}
        autoCapitalize="sentences"
        onChangeText={setQuery}
        placeholder="Search notes"
        placeholderTextColor="#9AA59B"
        style={styles.noteSearch}
        value={query}
      />
      {loading ? <Text style={styles.muted}>Loading notes…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && notes.length === 0 ? (
        <Text style={styles.noteEmpty}>
          {query ? "No notes match this search." : "No notes yet."}
        </Text>
      ) : null}
      {notes.map((note) => (
        <View key={note.id} style={styles.noteRow}>
          <Text style={styles.noteContent}>{note.content}</Text>
          <View style={styles.noteActions}>
            <Pressable
              accessibilityLabel={`Edit note: ${note.content}`}
              accessibilityRole="button"
              onPress={() => openEditNote(note)}
              style={({ pressed }) => [
                styles.noteAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.noteActionText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Delete note: ${note.content}`}
              accessibilityRole="button"
              onPress={() => confirmDelete(note)}
              style={({ pressed }) => [
                styles.noteAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.noteActionText, styles.dangerText]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Modal
        accessibilityViewIsModal
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
        visible={editorOpen}
      >
        <ScrollView
          contentContainerStyle={styles.modalContent}
          style={styles.screen}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>
                {editing ? "EDIT NOTE" : "NEW NOTE"}
              </Text>
              <Text style={styles.modalTitle}>
                {editing ? "Refine the thought." : "Keep the thought."}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close note editor"
              accessibilityRole="button"
              onPress={() => setEditorOpen(false)}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Note text"
            autoFocus
            multiline
            onChangeText={setDraft}
            placeholder="Write a plain-text note"
            placeholderTextColor="#9AA59B"
            style={styles.noteEditor}
            textAlignVertical="top"
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveNote()}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {editing ? "Save note" : "Add note"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditorOpen(false)}
            style={styles.cancelButton}
          >
            <Text style={styles.advancedText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

function EditMaterialModal({
  material,
  onClose,
  onSave,
}: {
  material: Material | null;
  onClose: () => void;
  onSave: (draft: MaterialEdit) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [minutes, setMinutes] = useState("");
  const [type, setType] = useState<MaterialType>("article");
  const [speed, setSpeed] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!material) return;
    setTitle(material.title);
    setUrl(material.originalUrl);
    setMinutes(
      material.manualEstimatedSeconds === null
        ? ""
        : String(material.manualEstimatedSeconds / 60),
    );
    setType(material.type);
    setSpeed(String(material.playbackSpeed));
    setError(null);
  }, [material]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title,
        originalUrl: url,
        estimatedMinutes: minutes.trim() === "" ? null : Number(minutes),
        type,
        playbackSpeed: Number(speed),
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save edits.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      accessibilityViewIsModal
      animationType="slide"
      onRequestClose={onClose}
      visible={material !== null}
    >
      <ScrollView
        contentContainerStyle={styles.modalContent}
        style={styles.screen}
      >
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.eyebrow}>EDIT MATERIAL</Text>
            <Text style={styles.modalTitle}>Shape the record.</Text>
          </View>
          <Pressable
            accessibilityLabel="Close edit material"
            accessibilityRole="button"
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field
          label="Source URL"
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
        />
        <Field
          label="Estimated minutes override"
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="decimal-pad"
          placeholder="Clear to use source estimate"
        />
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.choiceRow}>
          {(["article", "video", "unknown"] as const).map((option) => (
            <Choice
              active={type === option}
              key={option}
              label={typeLabel(option)}
              onPress={() => setType(option)}
            />
          ))}
        </View>
        {type === "video" ? (
          <Field
            label="Video playback speed"
            value={speed}
            onChangeText={setSpeed}
            keyboardType="decimal-pad"
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Save changes</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancelButton}
        >
          <Text style={styles.advancedText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "url" | "decimal-pad" | "default";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA59B"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        active && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function typeLabel(type: MaterialType): string {
  return type === "unknown" ? "Unknown" : type[0].toUpperCase() + type.slice(1);
}

function emptyTitle(filter: MaterialListFilter): string {
  if (filter === "all") return "No saved links yet";
  if (filter === "inbox") return "Nothing saved for later";
  return `No items in ${materialFilters.find((item) => item.key === filter)?.label ?? "Library"}`;
}

function emptyDescription(filter: MaterialListFilter): string {
  if (filter === "inbox") return "Links you save for later appear here.";
  if (filter === "all") return "Save an article or video to get started.";
  return "Items appear here as their status changes.";
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  list: { gap: 12 },
  notesPanel: {
    backgroundColor: colors.paper,
    borderRadius: 11,
    gap: 8,
    padding: 10,
  },
  notesHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notesTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  newNoteButton: {
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  newNoteText: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  noteSearch: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  noteEmpty: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  noteRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 7,
    paddingTop: 9,
  },
  noteContent: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  noteActions: { flexDirection: "row", gap: 5 },
  noteAction: {
    borderRadius: 6,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  noteActionText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  primary: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 9,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  primaryText: { color: colors.panel, fontSize: 15, fontWeight: "700" },
  advancedText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  advancedPanel: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 10,
  },
  advancedAction: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  advancedActionText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  dangerText: { color: colors.danger },
  loading: { alignItems: "center", gap: 10, padding: 30 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  modalContent: { gap: 16, padding: 24, paddingTop: 52 },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  closeText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  field: { gap: 7 },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 13,
  },
  noteEditor: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 180,
    padding: 13,
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: {
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  choiceSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  choiceTextSelected: { color: colors.accent },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
});
