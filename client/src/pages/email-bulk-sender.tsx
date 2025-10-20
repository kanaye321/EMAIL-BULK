import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send, Loader2, CheckCircle, XCircle, Plus, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EmailRecipient {
  email: string;
  [key: string]: string;
}

interface EmailResult {
  email: string;
  status: 'success' | 'failed';
  error?: string;
}

export default function EmailBulkSender() {
  const { toast } = useToast();
  const [ccEmails, setCcEmails] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailTemplate, setEmailTemplate] = useState("");
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [sendResults, setSendResults] = useState<EmailResult[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isTestingSMTP, setIsTestingSMTP] = useState(false);

  // Recipient form dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  const sendBulkEmailMutation = useMutation({
    mutationFn: async (data: { recipients: EmailRecipient[]; subject: string; template: string; cc?: string }) => {
      const response = await apiRequest('POST', '/api/email-bulk-send', data);
      return response.json();
    },
    onSuccess: (data) => {
      setSendResults(data.results || []);
      const successCount = data.results.filter((r: EmailResult) => r.status === 'success').length;
      const failCount = data.results.filter((r: EmailResult) => r.status === 'failed').length;

      toast({
        title: "Bulk email sending completed",
        description: `${successCount} emails sent successfully, ${failCount} failed.`,
      });
      setIsSending(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending bulk emails",
        description: error.message || "Failed to send emails. Please try again.",
        variant: "destructive",
      });
      setIsSending(false);
    }
  });

  const handleAddCustomField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleUpdateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const handleAddRecipient = () => {
    if (!currentEmail || !currentEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Email address is required.",
        variant: "destructive",
      });
      return;
    }

    const recipient: EmailRecipient = { email: currentEmail.trim() };
    customFields.forEach(field => {
      if (field.key.trim()) {
        recipient[field.key.trim()] = field.value.trim();
      }
    });

    setRecipients([...recipients, recipient]);
    setCurrentEmail("");
    setCustomFields([]);
    setIsAddDialogOpen(false);

    toast({
      title: "Recipient added",
      description: `${currentEmail} has been added to the recipients list.`,
    });
  };

  const handleEditRecipient = (index: number) => {
    const recipient = recipients[index];
    setCurrentEmail(recipient.email);

    const fields: { key: string; value: string }[] = [];
    Object.keys(recipient).forEach(key => {
      if (key !== 'email') {
        fields.push({ key, value: recipient[key] });
      }
    });

    setCustomFields(fields);
    setEditingIndex(index);
    setIsEditDialogOpen(true);
  };

  const handleUpdateRecipient = () => {
    if (editingIndex === null) return;

    if (!currentEmail || !currentEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Email address is required.",
        variant: "destructive",
      });
      return;
    }

    const recipient: EmailRecipient = { email: currentEmail.trim() };
    customFields.forEach(field => {
      if (field.key.trim()) {
        recipient[field.key.trim()] = field.value.trim();
      }
    });

    const updated = [...recipients];
    updated[editingIndex] = recipient;
    setRecipients(updated);

    setCurrentEmail("");
    setCustomFields([]);
    setEditingIndex(null);
    setIsEditDialogOpen(false);

    toast({
      title: "Recipient updated",
      description: "Recipient information has been updated.",
    });
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
    toast({
      title: "Recipient removed",
      description: "Recipient has been removed from the list.",
    });
  };

  const replacePlaceholders = (template: string, recipient: EmailRecipient): string => {
    let result = template;
    Object.keys(recipient).forEach(key => {
      const placeholder = `{${key}}`;
      const value = recipient[key] || '';
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    return result;
  };

  const handleTestSMTP = async () => {
    setIsTestingSMTP(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "SMTP Test Successful",
          description: data.message || "Test email sent successfully!",
        });
      } else {
        toast({
          title: "SMTP Test Failed",
          description: data.message || "Failed to send test email. Please check your email configuration.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "SMTP Test Error",
        description: error.message || "Failed to test email connection.",
        variant: "destructive",
      });
    } finally {
      setIsTestingSMTP(false);
    }
  };

  const handleSendEmails = () => {
    if (!emailSubject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email subject.",
        variant: "destructive",
      });
      return;
    }

    if (!emailTemplate.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email template.",
        variant: "destructive",
      });
      return;
    }

    if (recipients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setSendResults([]);
    sendBulkEmailMutation.mutate({
      recipients,
      subject: emailSubject,
      template: emailTemplate,
      cc: ccEmails.trim() || undefined
    });
  };

  const RecipientFormDialog = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    title 
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: () => void; 
    title: string;
  }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter the recipient's email and any custom fields you want to use in the template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Email Address *</Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder="user@example.com"
              value={currentEmail}
              onChange={(e) => setCurrentEmail(e.target.value)}
            />
          </div>

          <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Custom Fields (Placeholders)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddCustomField}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {customFields.map((field, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Field name (e.g., name, department, device)"
                        value={field.key}
                        onChange={(e) => handleUpdateCustomField(index, 'key', e.target.value)}
                      />
                      {field.key && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Placeholder: <code className="bg-muted px-1 rounded">{`{${field.key}}`}</code>
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Field value for this recipient"
                        value={field.value}
                        onChange={(e) => handleUpdateCustomField(index, 'value', e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={() => handleRemoveCustomField(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {customFields.length === 0 && (
                <div className="rounded-lg border-2 border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    No custom fields added yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click "Add Field" to create custom placeholders like {`{name}`}, {`{device}`}, {`{serial}`}, etc.
                  </p>
                </div>
              )}

              {customFields.length > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                    💡 Tip: Common Placeholders
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Examples: name, department, device, serial, location, knoxId, approvalNumber, date, etc.
                  </p>
                </div>
              )}
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            {title.includes('Edit') ? 'Update' : 'Add'} Recipient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Email Bulk Sender" 
        description="Send personalized emails to multiple recipients with custom fields"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Configuration Test
          </CardTitle>
          <CardDescription>
            Test your email configuration before sending bulk emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleTestSMTP}
            disabled={isTestingSMTP}
            variant="outline"
          >
            {isTestingSMTP ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {isTestingSMTP ? "Testing SMTP..." : "Test Email Configuration"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure the email subject, CC recipients, and template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailSubject">Email Subject</Label>
                <Input
                  id="emailSubject"
                  placeholder="Your Email Subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ccEmails">CC (optional, comma-separated)</Label>
                <Input
                  id="ccEmails"
                  placeholder="admin@example.com, manager@example.com"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailTemplate">Email Body Template</Label>
                <Textarea
                  id="emailTemplate"
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Hi {name},&#10;&#10;Your custom message here...&#10;&#10;Best regards"
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Use placeholders matching your custom field names (e.g., {`{name}`}, {`{department}`}, {`{customField}`})
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Recipients
              </CardTitle>
              <CardDescription>
                Add recipients with custom fields for personalized emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Recipient
              </Button>

              {recipients.length > 0 && (
                <div className="rounded-lg border">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                    <p className="font-medium">Recipients List</p>
                    <Badge>{recipients.length} recipients</Badge>
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="divide-y">
                      {recipients.map((recipient, index) => (
                        <div key={index} className="p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{recipient.email}</div>
                              {Object.keys(recipient).filter(k => k !== 'email').length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.keys(recipient)
                                    .filter(k => k !== 'email')
                                    .map(key => (
                                      <Badge key={key} variant="secondary" className="text-xs">
                                        {key}: {recipient[key]}
                                      </Badge>
                                    ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditRecipient(index)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveRecipient(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button 
                onClick={handleSendEmails} 
                disabled={isSending || recipients.length === 0}
                className="w-full"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isSending ? `Sending ${recipients.length} Emails...` : `Send ${recipients.length} Email${recipients.length !== 1 ? 's' : ''}`}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Email Preview & Results</CardTitle>
              <CardDescription>
                Preview how emails will look and view sending results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recipients.length > 0 && !isSending && sendResults.length === 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Preview (First Recipient)</Label>
                    <div className="mt-2 rounded-lg border p-4 bg-muted/50">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">To:</span> {recipients[0].email}
                        </div>
                        {ccEmails && (
                          <div>
                            <span className="font-medium">CC:</span> {ccEmails}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Subject:</span> {emailSubject}
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <pre className="whitespace-pre-wrap text-xs">
                            {replacePlaceholders(emailTemplate, recipients[0])}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sendResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Sending Results</h3>
                    <div className="flex gap-2">
                      <Badge className="bg-green-500">
                        {sendResults.filter(r => r.status === 'success').length} Success
                      </Badge>
                      <Badge variant="destructive">
                        {sendResults.filter(r => r.status === 'failed').length} Failed
                      </Badge>
                    </div>
                  </div>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {sendResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            result.status === 'success'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {result.status === 'success' ? (
                              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-sm">{result.email}</div>
                              {result.error && (
                                <div className="text-xs text-red-600 mt-1">{result.error}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {recipients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Add recipients to preview emails</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RecipientFormDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setCurrentEmail("");
          setCustomFields([]);
        }}
        onSubmit={handleAddRecipient}
        title="Add Recipient"
      />

      <RecipientFormDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setCurrentEmail("");
          setCustomFields([]);
          setEditingIndex(null);
        }}
        onSubmit={handleUpdateRecipient}
        title="Edit Recipient"
      />
    </div>
  );
}