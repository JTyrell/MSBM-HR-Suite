import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PAYE_TAX_CODES, CONTRACT_TYPES, jamaicaComplianceSchema } from "@/lib/validation/jamaican-fields";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface JaComplianceFieldsProps {
  profileId: string;
  initialData: {
    trn?: string | null;
    nis_number?: string | null;
    nht_number?: string | null;
    paye_tax_code?: string | null;
    contract_type?: string | null;
    grade_step?: string | null;
    role_tier?: string | null;
    reporting_manager_id?: string | null;
  };
  roleTiers: { id: string; name: string; level: number }[];
  managers: { user_id: string; first_name: string; last_name: string }[];
  onUpdate: () => void;
  readOnly?: boolean;
}

export default function JaComplianceFields({
  profileId,
  initialData,
  roleTiers,
  managers,
  onUpdate,
  readOnly = false,
}: JaComplianceFieldsProps) {
  const [form, setForm] = useState({
    trn: initialData.trn || "",
    nis_number: initialData.nis_number || "",
    nht_number: initialData.nht_number || "",
    paye_tax_code: initialData.paye_tax_code || "",
    contract_type: initialData.contract_type || "",
    grade_step: initialData.grade_step || "",
    role_tier: initialData.role_tier || "",
    reporting_manager_id: initialData.reporting_manager_id || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const result = jamaicaComplianceSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(form)) {
      updates[key] = value || null;
    }
    const { error } = await supabase.from("profiles").update(updates).eq("id", profileId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Compliance fields updated");
      onUpdate();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Jamaica Compliance (MyHR+/HRplus)</h3>
        <Badge variant="outline" className="text-xs">Statutory</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">TRN (Tax Registration Number)</Label>
          <Input
            value={form.trn}
            onChange={(e) => setForm({ ...form, trn: e.target.value })}
            placeholder="123456789"
            maxLength={9}
            disabled={readOnly}
            className={errors.trn ? "border-destructive" : ""}
          />
          {errors.trn && <p className="text-xs text-destructive">{errors.trn}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">NIS Number</Label>
          <Input
            value={form.nis_number}
            onChange={(e) => setForm({ ...form, nis_number: e.target.value.toUpperCase() })}
            placeholder="AB-123456-C"
            maxLength={12}
            disabled={readOnly}
            className={errors.nis_number ? "border-destructive" : ""}
          />
          {errors.nis_number && <p className="text-xs text-destructive">{errors.nis_number}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">NHT Number</Label>
          <Input
            value={form.nht_number}
            onChange={(e) => setForm({ ...form, nht_number: e.target.value })}
            placeholder="NHT number"
            maxLength={20}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">PAYE Tax Code</Label>
          <Select value={form.paye_tax_code} onValueChange={(v) => setForm({ ...form, paye_tax_code: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Select code..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {PAYE_TAX_CODES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Contract Type</Label>
          <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {CONTRACT_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Grade/Step</Label>
          <Input
            value={form.grade_step}
            onChange={(e) => setForm({ ...form, grade_step: e.target.value })}
            placeholder="e.g. Grade 5 Step 3"
            maxLength={20}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Role Tier (University)</Label>
          <Select value={form.role_tier} onValueChange={(v) => setForm({ ...form, role_tier: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Select tier..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {roleTiers.map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name} (Level {t.level})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Reporting Manager</Label>
          <Select value={form.reporting_manager_id} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!readOnly && (
        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Compliance Fields"}
          </button>
        </div>
      )}
    </div>
  );
}
