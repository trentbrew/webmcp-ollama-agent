<script lang="ts">
  import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Switch,
    Slider,
    Separator,
    Badge,
    Collapsible,
  } from '../components/ui';
  import { PageSection } from '../components/shell';

  let switchOn = $state(true);
  let sliderValue = $state(0.7);
  let collapsibleOpen = $state(false);
</script>

<div class="space-y-3">
  <PageSection title="Buttons">
    <div class="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
    <Separator class="my-3" />
    <div class="flex flex-wrap items-center gap-2">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="icon" aria-label="Icon button">+</Button>
      <Button disabled>Disabled</Button>
    </div>
  </PageSection>

  <PageSection title="Card compound">
    <Card>
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Muted description text using DaisyUI tokens.</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-base-content/70">Card body content inside the shell card surface.</p>
      </CardContent>
    </Card>
  </PageSection>

  <PageSection title="Form controls">
    <div class="space-y-3">
      <div class="space-y-1">
        <Label for="demo-input">Input</Label>
        <Input id="demo-input" placeholder="Type something…" />
      </div>
      <div class="shell-setting-row">
        <Label>Switch</Label>
        <Switch bind:checked={switchOn} />
      </div>
      <div class="space-y-1">
        <div class="flex justify-between">
          <Label for="demo-slider">Slider</Label>
          <span class="text-xs tabular-nums text-base-content/60">{sliderValue}</span>
        </div>
        <Slider id="demo-slider" min={0} max={1} step={0.05} bind:value={sliderValue} />
      </div>
    </div>
  </PageSection>

  <PageSection title="Badges & collapsible">
    <div class="flex flex-wrap gap-2 mb-3">
      <Badge>Default</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="secondary">Secondary</Badge>
    </div>
    <Collapsible title="Click to expand" bind:open={collapsibleOpen}>
      <p>Collapsible content with slide transition. No external headless library required.</p>
    </Collapsible>
  </PageSection>
</div>
