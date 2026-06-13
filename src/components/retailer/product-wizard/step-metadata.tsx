import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AgeRangeChips } from '@/components/retailer/age-range-chips';
import { OccasionChipPicker } from './occasion-chip-picker';
import type { WizardFormValues } from './types';

export function StepMetadata({ form }: { form: UseFormReturn<WizardFormValues> }) {
  const { register, setValue, watch, formState: { errors } } = form;
  const [confirmFinalSale, setConfirmFinalSale] = useState(false);

  function onPolicyChange(v: string) {
    if (v === 'final_sale' && watch('listingPolicy') !== 'final_sale') {
      setConfirmFinalSale(true);
      return;
    }
    setValue('listingPolicy', v as WizardFormValues['listingPolicy'], { shouldDirty: true });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Label hint="Optional · multi-select · years">Age groups</Label>
        <AgeRangeChips
          value={watch('ageGroups') ?? []}
          onChange={(next) => setValue('ageGroups', next, { shouldDirty: true })}
        />
      </div>

      <div>
        <Label hint="Optional · multi-select">Occasion tags</Label>
        <OccasionChipPicker
          value={watch('occasion') ?? []}
          onChange={(next) => setValue('occasion', next, { shouldDirty: true })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label required>Return policy</Label>
          <Select value={watch('listingPolicy')} onValueChange={onPolicyChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="return">Returnable</SelectItem>
              <SelectItem value="replace">Replace only</SelectItem>
              <SelectItem value="final_sale">Final sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="hsn" hint="GST">HSN code</Label>
          <Input id="hsn" mono placeholder="e.g. 6105" {...register('hsn')} />
          <FieldError>{errors.hsn?.message}</FieldError>
        </div>
      </div>

      <Dialog open={confirmFinalSale} onOpenChange={setConfirmFinalSale}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch to Final sale?</DialogTitle>
            <DialogDescription>
              Shoppers will see <span className="font-medium text-ink">"No returns"</span> on this
              product. Use sparingly — it lowers buyer trust.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmFinalSale(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setValue('listingPolicy', 'final_sale', { shouldDirty: true });
                setConfirmFinalSale(false);
              }}
            >
              Yes, final sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
