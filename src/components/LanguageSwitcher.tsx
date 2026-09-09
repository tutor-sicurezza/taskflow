import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Translate } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { LINGUE, type Lingua } from '@/lib/i18n';

/**
 * Selettore della lingua.
 *
 * Compare anche prima dell'accesso: chi non capisce la schermata di login non
 * puo' entrare per cambiarla.
 */
export function LanguageSwitcher({ compatto = false }: { compatto?: boolean }) {
  const { lingua, impostaLingua, t } = useTranslation();

  return (
    <Select value={lingua} onValueChange={(v) => impostaLingua(v as Lingua)}>
      <SelectTrigger
        className={compatto ? 'w-[130px]' : 'w-[160px]'}
        aria-label={t('comune.lingua')}
      >
        <Translate className="mr-2 h-4 w-4" weight="duotone" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LINGUE).map(([codice, nome]) => (
          <SelectItem key={codice} value={codice}>
            {nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
