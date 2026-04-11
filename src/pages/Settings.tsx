import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const { profile, roles } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
    setLoading(false);
  };

  return (
    <div className="max-w-2xl space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="capitalize">{r.replace("_", " ")}</Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
