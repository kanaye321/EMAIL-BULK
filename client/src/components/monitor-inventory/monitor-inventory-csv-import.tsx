
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  UploadIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XIcon,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Progress
} from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CSVMonitorInventory {
  seatNumber?: string;
  knoxId?: string;
  assetNumber?: string;
  serialNumber?: string;
  model?: string;
  remarks?: string;
  department?: string;
}

interface MonitorInventoryCSVImportProps {
  onImportComplete: () => void;
}

export default function MonitorInventoryCSVImport({ onImportComplete }: MonitorInventoryCSVImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedMonitors, setParsedMonitors] = useState<CSVMonitorInventory[] | null>(null);
  const [importStatus, setImportStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    successful: number;
    updated: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const parseCSV = (csvContent: string): CSVMonitorInventory[] => {
    try {
      // Enhanced CSV parser that handles multi-line text within quoted fields
      const parseCSVContent = (content: string): string[][] => {
        const result: string[][] = [];
        const lines = content.split('\n');
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          let charIndex = 0;

          while (charIndex < line.length) {
            const char = line[charIndex];
            const nextChar = line[charIndex + 1];

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                // Handle escaped quotes within quoted field
                currentField += '"';
                charIndex += 2;
              } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                charIndex++;
              }
            } else if (char === ',' && !inQuotes) {
              // End of field when not in quotes
              currentRow.push(currentField.trim());
              currentField = '';
              charIndex++;
            } else {
              // Regular character
              currentField += char;
              charIndex++;
            }
          }

          // If we're in quotes, add a newline and continue to next line
          if (inQuotes && lineIndex < lines.length - 1) {
            currentField += '\n';
          } else {
            // End of line and not in quotes, finish the field and row
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field.length > 0) || result.length === 0) {
              result.push([...currentRow]);
            }
            currentRow = [];
            currentField = '';
            inQuotes = false;
          }
        }

        // Handle any remaining field/row
        if (currentField || currentRow.length > 0) {
          if (currentField) currentRow.push(currentField.trim());
          if (currentRow.length > 0) result.push(currentRow);
        }

        return result;
      };

      const rows = parseCSVContent(csvContent);

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }

      // Parse header row
      const headers = rows[0].map(header => header.trim().toLowerCase());

      // Check if required columns exist
      const hasRequiredColumn = headers.some(header => 
        ['seatnumber', 'seat_number', 'seat number', 'seat'].includes(header)
      );

      if (!hasRequiredColumn) {
        throw new Error('CSV must contain a seat number column (seatNumber, seat_number, seat number, or seat)');
      }

      // Parse data rows
      const monitors: CSVMonitorInventory[] = [];
      let emptyRowsSkipped = 0;

      for (let i = 1; i < rows.length; i++) {
        try {
          const values = rows[i];
          
          // Skip completely empty rows
          if (values.length === 0 || values.every(val => !val || val.trim() === '')) {
            emptyRowsSkipped++;
            continue;
          }

          // Pad with empty strings if needed
          while (values.length < headers.length) {
            values.push('');
          }

          const item: any = {};
          let hasAnyData = false;
          let hasSeatNumber = false;

          headers.forEach((header, index) => {
            let value = values[index] || '';
            
            // Replace empty cells with "-" but preserve multi-line content
            if (!value || value.trim() === '' || value === 'N/A' || value === 'NULL') {
              value = '-';
            } else {
              // Trim whitespace but preserve internal newlines
              value = value.trim();
            }

            if (value !== '-') {
              hasAnyData = true;
            }

            switch (header) {
              case 'seatnumber':
              case 'seat_number':
              case 'seat number':
              case 'seat':
                item.seatNumber = value;
                hasSeatNumber = true;
                break;
              case 'knoxid':
              case 'knox_id':
              case 'knox id':
                item.knoxId = value;
                break;
              case 'assetnumber':
              case 'asset_number':
              case 'asset number':
              case 'asset':
                item.assetNumber = value;
                break;
              case 'serialnumber':
              case 'serial_number':
              case 'serial number':
              case 'serial':
                item.serialNumber = value;
                break;
              case 'model':
                item.model = value;
                break;
              case 'remarks':
              case 'notes':
              case 'description':
                item.remarks = value;
                break;
              case 'department':
              case 'dept':
                item.department = value;
                break;
              default:
                // Store unknown columns as well
                item[header] = value;
                break;
            }
          });

          if (hasAnyData && hasSeatNumber) {
            monitors.push(item as CSVMonitorInventory);
          } else if (hasAnyData && !hasSeatNumber) {
            console.warn(`Row ${i + 1}: Skipped - missing seat number`);
          } else {
            emptyRowsSkipped++;
          }
        } catch (rowError) {
          console.error(`Error parsing row ${i + 1}:`, rowError);
          throw new Error(`Error parsing row ${i + 1}: ${rowError.message}`);
        }
      }

      if (monitors.length === 0) {
        throw new Error('No valid monitor data found in CSV file');
      }

      return monitors;
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw error;
    }
  };

  const convertCSVToMonitorInventory = (csvMonitors: CSVMonitorInventory[]) => {
    return csvMonitors.map((item, index) => {
      // Validate that seat number exists
      if (!item.seatNumber || item.seatNumber.trim() === '') {
        throw new Error(`Row ${index + 1}: Seat number is required`);
      }

      return {
        seatNumber: item.seatNumber.trim(),
        knoxId: item.knoxId?.trim() || null,
        assetNumber: item.assetNumber?.trim() || null,
        serialNumber: item.serialNumber?.trim() || null,
        model: item.model?.trim() || null,
        remarks: item.remarks?.trim() || null,
        department: item.department?.trim() || null,
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      setParsedMonitors(null);
      setParseError(null);
      return;
    }

    const file = e.target.files[0];

    const maxSizeInMB = 25;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    if (file.size > maxSizeInBytes) {
      setParseError(`File size too large. Please use a CSV file smaller than ${maxSizeInMB}MB.`);
      toast({
        title: "File too large",
        description: `Please select a CSV file smaller than ${maxSizeInMB}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    setParsedMonitors(null);
    setImportSummary(null);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvContent = e.target?.result as string;
        const monitors = parseCSV(csvContent);
        setParsedMonitors(monitors);
        toast({
          title: "File parsed successfully",
          description: `Found ${monitors.length} monitor entries ready for import.`,
        });
      } catch (error) {
        console.error("CSV parse error:", error);
        setParseError((error as Error).message);
        toast({
          title: "Parse failed",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedMonitors) return;

    try {
      const monitorsToImport = convertCSVToMonitorInventory(parsedMonitors);
      importMutation.mutate(monitorsToImport);
    } catch (error) {
      toast({
        title: "Import failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (monitors: any[]) => {
      setImportStatus("uploading");
      setImportProgress(25);

      const response = await fetch("/api/monitor-inventory/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ monitors, upsert: true }),
      });

      setImportProgress(75);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Import failed");
      }

      const data = await response.json();
      setImportProgress(100);
      return data;
    },
    onSuccess: (data) => {
      setImportStatus("success");
      setImportSummary(data);
      queryClient.invalidateQueries({ queryKey: ['/api/monitor-inventory'] });

      const successMessage = data.updated > 0 
        ? `${data.successful} monitors created, ${data.updated} monitors updated successfully.`
        : `${data.successful} monitor entries imported successfully.`;

      toast({
        title: "Import successful",
        description: successMessage,
      });

      setTimeout(() => {
        onImportComplete();
      }, 2000);
    },
    onError: (error) => {
      setImportStatus("error");
      toast({
        title: "Import failed",
        description: (error as Error).message || "Failed to import monitor inventory",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setParsedMonitors(null);
    setParseError(null);
    setImportSummary(null);
    setImportProgress(0);
    setImportStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        seatNumber: "A001",
        knoxId: "KNOX001",
        assetNumber: "MON-001",
        serialNumber: "SN123456789",
        model: "Dell P2414H",
        remarks: "Primary monitor for workstation",
        department: "IT Department"
      },
      {
        seatNumber: "B002",
        knoxId: "KNOX002",
        assetNumber: "MON-002",
        serialNumber: "SN987654321",
        model: "HP E24 G4",
        remarks: "Secondary monitor",
        department: "Finance Department"
      }
    ];

    const csvContent = [
      "seatNumber,knoxId,assetNumber,serialNumber,model,remarks,department",
      ...templateData.map(row => 
        `"${row.seatNumber}","${row.knoxId}","${row.assetNumber}","${row.serialNumber}","${row.model}","${row.remarks}","${row.department}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "monitor_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Import Monitor Inventory from CSV</CardTitle>
        <CardDescription>
          Upload a CSV file with monitor inventory data to bulk import monitors. Maximum file size: 25MB.
          <br />
          <strong>Required columns:</strong> seatNumber
          <br />
          <strong>Optional columns:</strong> knoxId, assetNumber, serialNumber, model, remarks, department
        </CardDescription>
      </CardHeader>
      <CardContent>
        {parseError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Parse Error</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {importSummary && (
          <Alert variant={importSummary.failed > 0 ? "destructive" : "default"} className="mb-4">
            <CheckCircleIcon className="h-4 w-4" />
            <AlertTitle>Import Summary</AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                <p>Total: {importSummary.total}, Created: {importSummary.successful}, Updated: {importSummary.updated || 0}, Failed: {importSummary.failed}</p>
                {importSummary.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc pl-4 text-sm">
                      {importSummary.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {importSummary.errors.length > 5 && (
                        <li>... and {importSummary.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* File Selection */}
          <div className="flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importStatus === "uploading"}
            >
              <UploadIcon className="mr-2 h-4 w-4" />
              Select CSV File
            </Button>

            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                <FileTextIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm truncate max-w-[250px]">
                  {selectedFile.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={resetForm}
                  disabled={importStatus === "uploading"}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {importStatus === "uploading" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing monitors...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {/* Preview Table */}
          {parsedMonitors && parsedMonitors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Preview ({parsedMonitors.length} items)</h3>
              <div className="border rounded-lg max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seat Number</TableHead>
                      <TableHead>Knox ID</TableHead>
                      <TableHead>Asset Number</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedMonitors.slice(0, 10).map((monitor, index) => (
                      <TableRow key={index}>
                        <TableCell>{monitor.seatNumber || <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>{monitor.knoxId || <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>{monitor.assetNumber || <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>{monitor.serialNumber || <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>{monitor.model || <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>{monitor.department || <span className="text-gray-400">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedMonitors.length > 10 && (
                  <div className="p-2 text-center text-sm text-gray-500 border-t">
                    ... and {parsedMonitors.length - 10} more items
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={importStatus === "uploading"}
            >
              Reset
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                importStatus === "uploading" ||
                importStatus === "success" ||
                !parsedMonitors ||
                parsedMonitors.length === 0
              }
            >
              {importStatus === "uploading" ? "Importing..." : `Import ${parsedMonitors?.length || 0} Items`}
            </Button>
          </div>
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Download CSV Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
