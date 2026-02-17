'use client';

import { useState } from 'react';
import { Mic, MicOff, Sparkles, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import type { Group } from '@/types';
import type { TripFormData } from './index';

interface AIAssistantProps {
  groups: Group[];
  onFillForm: (data: Partial<TripFormData>) => void;
}

export function AIAssistant({ groups, onFillForm }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Combine manual text with speech transcript
  const fullText = text + (transcript ? (text ? ' ' : '') + transcript : '');
  const displayText = fullText + (interimTranscript ? ' ' + interimTranscript : '');

  async function handleFillForm() {
    const input = fullText.trim();
    if (input.length < 10) {
      toast.error('Opisz wyjazd bardziej szczegółowo (min. 10 znaków)');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/ai/parse-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input,
          groups: groups.map(g => ({ id: g.id, name: g.name })),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || 'Nie udało się przetworzyć opisu');
        return;
      }

      onFillForm(result.data);
      toast.success('Formularz wypełniony przez AI! Sprawdź i popraw dane.');
    } catch {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleReset() {
    setText('');
    resetTranscript();
  }

  function handleTextChange(value: string) {
    setText(value);
    if (transcript) resetTranscript();
  }

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2 text-purple-700 text-base">
                <Sparkles className="h-5 w-5" />
                AI Asystent — opisz lub podyktuj wyjazd
              </CardTitle>
              {isOpen ? <ChevronUp className="h-5 w-5 text-purple-500" /> : <ChevronDown className="h-5 w-5 text-purple-500" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Opisz wyjazd swoimi słowami lub podyktuj. AI wypełni formularz automatycznie.
              Np: <em className="text-gray-700">&quot;Zakopane 15 marca, BP Pasternik 6:00, powrót 17 marca 18:00, grupa 2015, rata 500zł do 1 marca&quot;</em>
            </p>

            {/* Text area */}
            <div className="relative">
              <Textarea
                value={displayText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Opisz wyjazd... np. Zakopane, sobota 22 marca, BP Pasternik o 6:00, powrót niedziela 18:00, grupy 2015 i 2016, rata 1 - 500zł do 10 marca przelew, rata 2 - 200zł w dniu wyjazdu gotówka"
                rows={4}
                className="bg-white pr-12 text-sm"
              />
              {isListening && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-100 text-red-600">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium">Słucham...</span>
                </div>
              )}
            </div>

            {speechError && (
              <p className="text-sm text-red-500">{speechError}</p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Microphone button */}
              {isSupported && (
                <Button
                  type="button"
                  variant={isListening ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={isListening ? stopListening : startListening}
                  className={isListening ? 'animate-pulse' : ''}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      Zatrzymaj
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Dyktuj
                    </>
                  )}
                </Button>
              )}

              {/* Fill form button */}
              <Button
                type="button"
                size="sm"
                onClick={handleFillForm}
                disabled={isProcessing || displayText.trim().length < 10}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Przetwarzam...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Wypełnij formularz
                  </>
                )}
              </Button>

              {/* Reset button */}
              {(fullText || transcript) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Wyczyść
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
