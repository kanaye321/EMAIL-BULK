
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusIcon, DownloadIcon, UploadIcon, FileDownIcon, MonitorIcon, EditIcon, TrashIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MonitorInventoryForm from "@/components/monitor-inventory/monitor-inventory-form";
import MonitorInventoryCSVImport from "@/components/monitor-inventory/monitor-inventory-csv-import";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, downloadCSV } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function MonitorInventory() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [monitorToDelete, setMonitorToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [remarksFilter, setRemarksFilter] = useState("all");
  const { toast } = useToast();

  // Fetch monitor inventory
  const { data: monitors = [], isLoading, error } = useQuery({
    queryKey: ['/api/monitor-inventory'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/monitor-inventory', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch monitor inventory');
        }
        
        const data = await response.json();
        console.log('Monitor inventory data:', data);
        return Array.isArray(data) ? data : data.data || [];
      } catch (error) {
        console.error('Error fetching monitor inventory:', error);
        toast({
          title: "Error",
          description: "Failed to load monitor inventory. Please try again.",
          variant: "destructive",
        });
        return [];
      }
    },
    retry: 3,
    staleTime: 30000,
  });

  // Create monitor mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating monitor with data:', data);
      const response = await fetch('/api/monitor-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create monitor error:', errorData);
        throw new Error(errorData.message || 'Failed to create monitor');
      }

      const result = await response.json();
      console.log('Monitor created successfully:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('Create mutation success:', result);
      setIsDialogOpen(false);
      setEditingMonitor(null);
      queryClient.invalidateQueries({ queryKey: ['/api/monitor-inventory'] });
      toast({
        title: "Monitor added",
        description: "The monitor has been added successfully.",
      });
    },
    onError: (error) => {
      console.error('Create mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "There was an error adding the monitor. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update monitor mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      console.log('Updating monitor:', id, data);
      const response = await fetch(`/api/monitor-inventory/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Update monitor error:', errorData);
        throw new Error(errorData.message || 'Failed to update monitor');
      }

      const result = await response.json();
      console.log('Monitor updated successfully:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('Update mutation success:', result);
      setIsDialogOpen(false);
      setEditingMonitor(null);
      queryClient.invalidateQueries({ queryKey: ['/api/monitor-inventory'] });
      toast({
        title: "Monitor updated",
        description: "The monitor has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "There was an error updating the monitor. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete monitor mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/monitor-inventory/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete monitor');
      }

      // Handle 204 No Content response
      if (response.status === 204) {
        return { success: true };
      }

      return response.json();
    },
    onSuccess: () => {
      setMonitorToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['/api/monitor-inventory'] });
      toast({
        title: "Monitor deleted",
        description: "The monitor has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      setMonitorToDelete(null);
      toast({
        title: "Error",
        description: error.message || "There was an error deleting the monitor. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleMonitorSubmit = (data: any) => {
    console.log('Submitting monitor data:', data);
    
    // Validate required fields
    if (!data.seatNumber || data.seatNumber.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Seat number is required.",
        variant: "destructive",
      });
      return;
    }

    if (editingMonitor) {
      console.log('Updating monitor:', editingMonitor.id, data);
      updateMutation.mutate({ id: editingMonitor.id, data });
    } else {
      console.log('Creating new monitor:', data);
      createMutation.mutate(data);
    }
  };

  const handleExportCSV = () => {
    if (filteredMonitors && filteredMonitors.length > 0) {
      const csvData = filteredMonitors.map(monitor => ({
        seatNumber: monitor.seatNumber,
        knoxId: monitor.knoxId || '',
        assetNumber: monitor.assetNumber || '',
        serialNumber: monitor.serialNumber || '',
        model: monitor.model || '',
        remarks: monitor.remarks || '',
        department: monitor.department || '',
      }));
      downloadCSV(csvData, 'monitor_inventory.csv');
    } else {
      toast({
        title: "No data to export",
        description: "There is no monitor inventory data to export.",
      });
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
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'monitor-inventory-template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Template Downloaded",
      description: "Monitor inventory import template has been downloaded successfully."
    });
  };

  // Get unique values for filters
  const uniqueDepartments = Array.from(new Set(
    monitors.filter(monitor => monitor?.department).map(monitor => monitor.department)
  )).sort();
  
  const uniqueModels = Array.from(new Set(
    monitors.filter(monitor => monitor?.model).map(monitor => monitor.model)
  )).sort();

  // Filter monitors based on search term and filters
  const filteredMonitors = Array.isArray(monitors) ? monitors.filter(monitor => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        monitor?.seatNumber?.toLowerCase().includes(search) ||
        monitor?.knoxId?.toLowerCase().includes(search) ||
        monitor?.assetNumber?.toLowerCase().includes(search) ||
        monitor?.serialNumber?.toLowerCase().includes(search) ||
        monitor?.model?.toLowerCase().includes(search) ||
        monitor?.department?.toLowerCase().includes(search) ||
        monitor?.remarks?.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Department filter
    if (departmentFilter !== "all" && monitor?.department !== departmentFilter) {
      return false;
    }

    // Model filter
    if (modelFilter !== "all" && monitor?.model !== modelFilter) {
      return false;
    }

    // Remarks filter
    if (remarksFilter !== "all") {
      if (remarksFilter === "with-remarks" && (!monitor?.remarks || monitor.remarks.trim() === "")) {
        return false;
      }
      if (remarksFilter === "without-remarks" && (monitor?.remarks && monitor.remarks.trim() !== "")) {
        return false;
      }
    }

    return true;
  }) : [];

  // Calculate pagination
  const totalPages = Math.ceil(filteredMonitors.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMonitors = filteredMonitors.slice(startIndex, endIndex);

  // Reset to first page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1);
    switch (filterType) {
      case 'department':
        setDepartmentFilter(value);
        break;
      case 'model':
        setModelFilter(value);
        break;
      case 'remarks':
        setRemarksFilter(value);
        break;
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setDepartmentFilter("all");
    setModelFilter("all");
    setRemarksFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Monitor Inventory</h1>
          <p className="text-sm text-gray-600">Manage monitor inventory and seat assignments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportCSV}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDownIcon className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UploadIcon className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Monitor Inventory from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to bulk import monitor inventory data
                </DialogDescription>
              </DialogHeader>
              <MonitorInventoryCSVImport onImportComplete={() => setIsImportDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingMonitor(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Monitor
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMonitor ? 'Edit Monitor' : 'Add Monitor'}</DialogTitle>
                <DialogDescription>
                  {editingMonitor ? 'Update the monitor details' : 'Enter the details for the monitor'}
                </DialogDescription>
              </DialogHeader>
              <MonitorInventoryForm 
                onSubmit={handleMonitorSubmit} 
                isLoading={createMutation.isPending || updateMutation.isPending}
                defaultValues={editingMonitor}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by seat number, Knox ID, asset number, serial number, model, department, or remarks..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filters:</span>
          
          <Select value={departmentFilter} onValueChange={(value) => handleFilterChange('department', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepartments.map(dept => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modelFilter} onValueChange={(value) => handleFilterChange('model', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {uniqueModels.map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={remarksFilter} onValueChange={(value) => handleFilterChange('remarks', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Remarks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="with-remarks">With Remarks</SelectItem>
              <SelectItem value="without-remarks">Without Remarks</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monitor Inventory Management</CardTitle>
          <CardDescription>Track and manage monitor inventory across workstations</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-10">
              <MonitorIcon className="h-16 w-16 mx-auto text-red-400 mb-4" />
              <h3 className="text-lg font-medium mb-2 text-red-600">Error Loading Monitor Inventory</h3>
              <p className="text-gray-500 mb-4">{error.message}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <p className="ml-4 text-gray-600">Loading monitor inventory...</p>
            </div>
          ) : filteredMonitors && filteredMonitors.length > 0 ? (
            <>
              <div className="grid gap-4">
                {paginatedMonitors.map((monitor) => (
                <div key={monitor.id} className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MonitorIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">Seat: {monitor.seatNumber}</h3>
                          {monitor.department && (
                            <Badge variant="outline">{monitor.department}</Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          {monitor.knoxId && <p><span className="font-medium">Knox ID:</span> {monitor.knoxId}</p>}
                          {monitor.assetNumber && <p><span className="font-medium">Asset Number:</span> {monitor.assetNumber}</p>}
                          {monitor.serialNumber && <p><span className="font-medium">Serial Number:</span> {monitor.serialNumber}</p>}
                          {monitor.model && <p><span className="font-medium">Model:</span> {monitor.model}</p>}
                          {monitor.remarks && <p><span className="font-medium">Remarks:</span> {monitor.remarks}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('Editing monitor:', monitor);
                          setEditingMonitor(monitor);
                          setIsDialogOpen(true);
                        }}
                      >
                        <EditIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('Deleting monitor:', monitor);
                          setMonitorToDelete(monitor);
                        }}
                        className="text-red-600 hover:text-red-700"
                        disabled={deleteMutation.isPending}
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                  <div className="text-sm text-gray-500">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredMonitors.length)} of {filteredMonitors.length} monitors
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Select value={pageSize.toString()} onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select page size" />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50, 100].map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            Show {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>

                        {(() => {
                          const pages = [];
                          const startPage = Math.max(1, currentPage - 2);
                          const endPage = Math.min(totalPages, currentPage + 2);

                          // Add first page if not in range
                          if (startPage > 1) {
                            pages.push(
                              <PaginationItem key={1}>
                                <PaginationLink 
                                  onClick={() => setCurrentPage(1)}
                                  isActive={currentPage === 1}
                                  className="cursor-pointer"
                                >
                                  1
                                </PaginationLink>
                              </PaginationItem>
                            );
                            if (startPage > 2) {
                              pages.push(
                                <PaginationItem key="ellipsis1">
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                          }

                          // Add page range
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <PaginationItem key={i}>
                                <PaginationLink 
                                  onClick={() => setCurrentPage(i)}
                                  isActive={currentPage === i}
                                  className="cursor-pointer"
                                >
                                  {i}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          // Add last page if not in range
                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(
                                <PaginationItem key="ellipsis2">
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            pages.push(
                              <PaginationItem key={totalPages}>
                                <PaginationLink 
                                  onClick={() => setCurrentPage(totalPages)}
                                  isActive={currentPage === totalPages}
                                  className="cursor-pointer"
                                >
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          return pages;
                        })()}

                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <MonitorIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Monitor Inventory Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'No monitors match your search criteria.' : 'Start tracking your monitor inventory by adding the first monitor.'}
              </p>
              <div className="flex justify-center">
                <Button onClick={() => setIsDialogOpen(true)}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add First Monitor
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!monitorToDelete}
        onClose={() => setMonitorToDelete(null)}
        onConfirm={() => monitorToDelete && deleteMutation.mutate(monitorToDelete.id)}
        itemType="monitor"
        itemName={monitorToDelete ? `${monitorToDelete.seatNumber} (${monitorToDelete.model || 'Monitor'})` : ""}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
