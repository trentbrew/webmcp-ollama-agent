export const composerUi = $state({
  sessionPickerOpen: false,
  modelPickerOpen: false,
});

export function requestModelPicker() {
  composerUi.modelPickerOpen = true;
}

export function requestSessionPicker() {
  composerUi.sessionPickerOpen = true;
}

export function closeSessionPicker() {
  composerUi.sessionPickerOpen = false;
}

export function closeModelPicker() {
  composerUi.modelPickerOpen = false;
}
