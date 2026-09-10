import { format } from 'date-fns';

/**
 * Funzione di traduzione fornita dal chiamante.
 *
 * Questo modulo genera CSV e PDF fuori dall'albero React, quindi non puo'
 * usare useTranslation. Riceverla come parametro tiene la scelta della lingua
 * dove deve stare: quella di chi ha premuto "esporta" e scarica il file.
 */
type Traduci = (chiave: string) => string;

export interface TeamAnalyticsData {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime: number;
  employeeStats: Array<{
    id: string;
    name: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    notStartedTasks: number;
    overdueTasks: number;
    completionRate: number;
    avgCompletionTime: number;
    highPriorityTasks: number;
  }>;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface DepartmentAnalyticsData {
  departments: Array<{
    name: string;
    totalEmployees: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    notStartedTasks: number;
    overdueTasks: number;
    completionRate: number;
    avgTasksPerEmployee: number;
    highPriorityTasks: number;
  }>;
  totalDepartments: number;
  totalAssignedTasks: number;
  unassignedTasks: number;
}

export function exportTeamAnalyticsToCSV(data: TeamAnalyticsData, t: Traduci): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  
  let csvContent = `${t('TaskFlow Analytics - Team Performance Report')}\n`;
  csvContent += `${t('Generated')}: ${format(new Date(), 'PPpp')}\n\n`;
  
  csvContent += `${t('Overall Summary')}\n`;
  csvContent += `${t('Metric')},${t('Value')}\n`;
  csvContent += `${t('Total Tasks')},${data.totalTasks}\n`;
  csvContent += `${t('Completed Tasks')},${data.completedTasks}\n`;
  csvContent += `${t('In Progress Tasks')},${data.inProgressTasks}\n`;
  csvContent += `${t('Not Started Tasks')},${data.notStartedTasks}\n`;
  csvContent += `${t('Overdue Tasks')},${data.overdueTasks}\n`;
  csvContent += `${t('Completion Rate')},${data.completionRate.toFixed(2)}%\n`;
  csvContent += `${t('Average Completion Time')},${data.avgCompletionTime.toFixed(1)} ${t('days')}\n\n`;
  
  csvContent += `${t('Priority Breakdown')}\n`;
  csvContent += `${t('Priority')},${t('Count')}\n`;
  csvContent += `${t('High')},${data.priorityBreakdown.high}\n`;
  csvContent += `${t('Medium')},${data.priorityBreakdown.medium}\n`;
  csvContent += `${t('Low')},${data.priorityBreakdown.low}\n\n`;
  
  csvContent += `${t('Employee Performance')}\n`;
  csvContent += `${t('Name')},${t('Total Tasks')},${t('Completed')},${t('In Progress')},${t('Not Started')},${t('Overdue')},${t('Completion Rate')},${t('Avg Completion Time')},${t('High Priority Tasks')}\n`;
  data.employeeStats.forEach(emp => {
    csvContent += `"${emp.name}",${emp.totalTasks},${emp.completedTasks},${emp.inProgressTasks},${emp.notStartedTasks},${emp.overdueTasks},${emp.completionRate.toFixed(2)}%,${emp.avgCompletionTime.toFixed(1)},${emp.highPriorityTasks}\n`;
  });
  
  downloadCSV(csvContent, `team-analytics_${timestamp}.csv`);
}

export function exportDepartmentAnalyticsToCSV(data: DepartmentAnalyticsData, t: Traduci): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  
  let csvContent = `${t('TaskFlow Analytics - Department Performance Report')}\n`;
  csvContent += `${t('Generated')}: ${format(new Date(), 'PPpp')}\n\n`;
  
  csvContent += `${t('Overall Summary')}\n`;
  csvContent += `${t('Metric')},${t('Value')}\n`;
  csvContent += `${t('Total Departments')},${data.totalDepartments}\n`;
  csvContent += `${t('Total Assigned Tasks')},${data.totalAssignedTasks}\n`;
  csvContent += `${t('Unassigned Tasks')},${data.unassignedTasks}\n\n`;
  
  csvContent += `${t('Department Performance')}\n`;
  csvContent += `${t('Department')},${t('Employees')},${t('Total Tasks')},${t('Completed')},${t('In Progress')},${t('Not Started')},${t('Overdue')},${t('Completion Rate')},${t('Avg Tasks/Employee')},${t('High Priority Tasks')}\n`;
  data.departments.forEach(dept => {
    csvContent += `"${dept.name}",${dept.totalEmployees},${dept.totalTasks},${dept.completedTasks},${dept.inProgressTasks},${dept.notStartedTasks},${dept.overdueTasks},${dept.completionRate.toFixed(2)}%,${dept.avgTasksPerEmployee.toFixed(1)},${dept.highPriorityTasks}\n`;
  });
  
  downloadCSV(csvContent, `department-analytics_${timestamp}.csv`);
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function exportTeamAnalyticsToPDF(data: TeamAnalyticsData, t: Traduci): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${t('Team Analytics Report')}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          color: #1f2937;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid oklch(0.45 0.12 210);
        }
        h1 {
          color: oklch(0.45 0.12 210);
          margin-bottom: 10px;
          font-size: 32px;
        }
        .generated-date {
          color: #6b7280;
          font-size: 14px;
        }
        .section {
          margin-bottom: 40px;
        }
        h2 {
          color: oklch(0.45 0.12 210);
          font-size: 24px;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e7eb;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid oklch(0.45 0.12 210);
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          background: white;
        }
        th {
          background: oklch(0.45 0.12 210);
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        tr:hover {
          background: #f9fafb;
        }
        .priority-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 20px;
        }
        .priority-card {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .priority-high {
          border-left: 4px solid #ef4444;
        }
        .priority-medium {
          border-left: 4px solid #f59e0b;
        }
        .priority-low {
          border-left: 4px solid #6b7280;
        }
        .completion-high {
          color: #10b981;
          font-weight: bold;
        }
        .completion-medium {
          color: #f59e0b;
          font-weight: bold;
        }
        .completion-low {
          color: #ef4444;
          font-weight: bold;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${t('Team Analytics Report')}</h1>
        <div class="generated-date">Generated on ${format(new Date(), 'PPPP \'at\' p')}</div>
      </div>

      <div class="section">
        <h2>${t('Overall Summary')}</h2>
        <div class="summary-grid">
          <div class="stat-card">
            <div class="stat-label">${t('Total Tasks')}</div>
            <div class="stat-value">${data.totalTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Completion Rate')}</div>
            <div class="stat-value">${data.completionRate.toFixed(1)}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Completed Tasks')}</div>
            <div class="stat-value">${data.completedTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('In Progress Tasks')}</div>
            <div class="stat-value">${data.inProgressTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Not Started Tasks')}</div>
            <div class="stat-value">${data.notStartedTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Overdue Tasks')}</div>
            <div class="stat-value" style="color: ${data.overdueTasks > 0 ? '#ef4444' : '#10b981'};">${data.overdueTasks}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-label">${t('Average Completion Time')}</div>
          <div class="stat-value">${data.avgCompletionTime.toFixed(1)} days</div>
        </div>
      </div>

      <div class="section">
        <h2>${t('Priority Breakdown')}</h2>
        <div class="priority-grid">
          <div class="priority-card priority-high">
            <div class="stat-label">${t('High Priority')}</div>
            <div class="stat-value">${data.priorityBreakdown.high}</div>
          </div>
          <div class="priority-card priority-medium">
            <div class="stat-label">${t('Medium Priority')}</div>
            <div class="stat-value">${data.priorityBreakdown.medium}</div>
          </div>
          <div class="priority-card priority-low">
            <div class="stat-label">${t('Low Priority')}</div>
            <div class="stat-value">${data.priorityBreakdown.low}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>${t('Employee Performance')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('Name')}</th>
              <th>${t('Total')}</th>
              <th>${t('Completed')}</th>
              <th>${t('In Progress')}</th>
              <th>${t('Not Started')}</th>
              <th>${t('Overdue')}</th>
              <th>${t('Rate')}</th>
              <th>${t('Avg Time')}</th>
              <th>${t('High Priority')}</th>
            </tr>
          </thead>
          <tbody>
            ${data.employeeStats.map(emp => `
              <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.totalTasks}</td>
                <td style="color: #10b981;">${emp.completedTasks}</td>
                <td style="color: #3b82f6;">${emp.inProgressTasks}</td>
                <td>${emp.notStartedTasks}</td>
                <td style="color: ${emp.overdueTasks > 0 ? '#ef4444' : '#6b7280'};">${emp.overdueTasks}</td>
                <td class="${emp.completionRate >= 75 ? 'completion-high' : emp.completionRate >= 50 ? 'completion-medium' : 'completion-low'}">${emp.completionRate.toFixed(1)}%</td>
                <td>${emp.avgCompletionTime.toFixed(1)}d</td>
                <td style="color: ${emp.highPriorityTasks > 0 ? '#ef4444' : '#6b7280'};">${emp.highPriorityTasks}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>${t('TaskFlow Analytics - Team Performance Report')}</p>
        <p>This report contains ${data.employeeStats.length} team member${data.employeeStats.length !== 1 ? 's' : ''} and ${data.totalTasks} task${data.totalTasks !== 1 ? 's' : ''}</p>
      </div>
    </body>
    </html>
  `;
  
  downloadPDF(htmlContent, `team-analytics_${timestamp}.pdf`);
}

export function exportDepartmentAnalyticsToPDF(data: DepartmentAnalyticsData, t: Traduci): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${t('Department Analytics Report')}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          color: #1f2937;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid oklch(0.45 0.12 210);
        }
        h1 {
          color: oklch(0.45 0.12 210);
          margin-bottom: 10px;
          font-size: 32px;
        }
        .generated-date {
          color: #6b7280;
          font-size: 14px;
        }
        .section {
          margin-bottom: 40px;
        }
        h2 {
          color: oklch(0.45 0.12 210);
          font-size: 24px;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e7eb;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid oklch(0.45 0.12 210);
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          background: white;
        }
        th {
          background: oklch(0.45 0.12 210);
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        tr:hover {
          background: #f9fafb;
        }
        .completion-high {
          color: #10b981;
          font-weight: bold;
        }
        .completion-medium {
          color: #f59e0b;
          font-weight: bold;
        }
        .completion-low {
          color: #ef4444;
          font-weight: bold;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${t('Department Analytics Report')}</h1>
        <div class="generated-date">Generated on ${format(new Date(), 'PPPP \'at\' p')}</div>
      </div>

      <div class="section">
        <h2>${t('Overall Summary')}</h2>
        <div class="summary-grid">
          <div class="stat-card">
            <div class="stat-label">${t('Total Departments')}</div>
            <div class="stat-value">${data.totalDepartments}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Assigned Tasks')}</div>
            <div class="stat-value">${data.totalAssignedTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('Unassigned Tasks')}</div>
            <div class="stat-value">${data.unassignedTasks}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>${t('Department Performance')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('Department')}</th>
              <th>${t('Employees')}</th>
              <th>${t('Total')}</th>
              <th>${t('Completed')}</th>
              <th>${t('In Progress')}</th>
              <th>${t('Not Started')}</th>
              <th>${t('Overdue')}</th>
              <th>${t('Rate')}</th>
              <th>${t('Avg/Employee')}</th>
              <th>${t('High Priority')}</th>
            </tr>
          </thead>
          <tbody>
            ${data.departments.map(dept => `
              <tr>
                <td><strong>${dept.name}</strong></td>
                <td>${dept.totalEmployees}</td>
                <td>${dept.totalTasks}</td>
                <td style="color: #10b981;">${dept.completedTasks}</td>
                <td style="color: #3b82f6;">${dept.inProgressTasks}</td>
                <td>${dept.notStartedTasks}</td>
                <td style="color: ${dept.overdueTasks > 0 ? '#ef4444' : '#6b7280'};">${dept.overdueTasks}</td>
                <td class="${dept.completionRate >= 75 ? 'completion-high' : dept.completionRate >= 50 ? 'completion-medium' : 'completion-low'}">${dept.completionRate.toFixed(1)}%</td>
                <td>${dept.avgTasksPerEmployee.toFixed(1)}</td>
                <td style="color: ${dept.highPriorityTasks > 0 ? '#ef4444' : '#6b7280'};">${dept.highPriorityTasks}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>${t('TaskFlow Analytics - Department Performance Report')}</p>
        <p>This report contains ${data.totalDepartments} department${data.totalDepartments !== 1 ? 's' : ''} and ${data.totalAssignedTasks} assigned task${data.totalAssignedTasks !== 1 ? 's' : ''}</p>
      </div>
    </body>
    </html>
  `;
  
  downloadPDF(htmlContent, `department-analytics_${timestamp}.pdf`);
}

function downloadPDF(htmlContent: string, filename: string): void {
  const printWindow = window.open('', '', 'width=800,height=600');
  
  if (!printWindow) {
    alert('Please allow pop-ups to download PDF');
    return;
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 100);
    }, 250);
  };
}
