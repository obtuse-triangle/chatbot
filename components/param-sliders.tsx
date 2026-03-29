"use client"

import { useMemo } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useStore } from "@/lib/prompt-store"

function formatDecimalValue(value: number) {
  return value.toFixed(1)
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  testId,
  valueTestId,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  testId: string
  valueTestId: string
  onCommit: (value: number) => void
}) {
  const labelId = `${testId}-label`
  const displayValue = useMemo(() => (step === 1 ? String(value) : formatDecimalValue(value)), [step, value])

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" id={labelId}>
          {label}
        </Label>
        <span
          className="text-sm font-medium tabular-nums text-muted-foreground"
          data-testid={valueTestId}
        >
          {displayValue}
        </span>
      </div>

      <Slider
        aria-labelledby={labelId}
        className="w-full"
        data-testid={testId}
        defaultValue={[value]}
        max={max}
        min={min}
        onValueCommit={(nextValue) => {
          onCommit(nextValue[0] ?? value)
        }}
        step={step}
      />
    </div>
  )
}

export function ParamSliders() {
  const { temperature, topP, topK, setTemperature, setTopP, setTopK } = useStore(
    (state) => ({
      temperature: state.temperature,
      topP: state.topP,
      topK: state.topK,
      setTemperature: state.setTemperature,
      setTopP: state.setTopP,
      setTopK: state.setTopK,
    })
  )

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Generation parameters</CardTitle>
        <CardDescription>Adjust sampling before you send a request.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SliderField
          label="Temperature"
          value={temperature}
          min={0}
          max={1}
          step={0.1}
          testId="temperature-slider"
          valueTestId="temperature-value"
          onCommit={setTemperature}
        />
        <SliderField
          label="Top_P"
          value={topP}
          min={0}
          max={1}
          step={0.1}
          testId="top-p-slider"
          valueTestId="top-p-value"
          onCommit={setTopP}
        />
        <SliderField
          label="Top_K"
          value={topK}
          min={1}
          max={100}
          step={1}
          testId="top-k-slider"
          valueTestId="top-k-value"
          onCommit={setTopK}
        />
      </CardContent>
    </Card>
  )
}
