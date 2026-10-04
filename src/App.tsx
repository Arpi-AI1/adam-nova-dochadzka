import { useState, useEffect } from 'react';
import { Download, RefreshCw, RotateCcw, Calendar, CalendarOff, Users, Calendar as CalendarIcon, ChevronDown, ChevronUp, X, Ban, LockKeyhole, Star } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  selected: boolean;
  maxConsecutiveDays?: number;
  blockedDays: number[];
  requiredDays: number[];
}

interface Schedule {
  day: number;
  employees: string[];
  locked: boolean;
}

const MIN_WORKERS_PER_DAY = 2;
const MAX_WORKERS_PER_DAY = 3;

// Číslo verzie zobrazené vpravo hore (pri každej zmene zvýšiť)
const APP_VERSION = '3.1';

// Logo Arpad_AI: písmeno A v zaoblenom štvorci s „AI iskrou“
const ArpadLogo = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="arpad-logo-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f43f5e" />
        <stop offset="100%" stopColor="#881337" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#arpad-logo-bg)" />
    <path
      d="M9 23 L16 8 L23 23 M11.8 17.5 H20.2"
      fill="none"
      stroke="white"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M25 4.5 L25.9 6.6 L28 7.5 L25.9 8.4 L25 10.5 L24.1 8.4 L22 7.5 L24.1 6.6 Z" fill="#fecdd3" />
  </svg>
);

const defaultEmployees: Employee[] = [
  { id: 1, name: 'Zamestnanec 1', selected: true, blockedDays: [], requiredDays: [] },
  { id: 2, name: 'Zamestnanec 2', selected: true, blockedDays: [], requiredDays: [] },
  { id: 5, name: 'Zamestnanec 3', selected: true, blockedDays: [], requiredDays: [] },
  { id: 6, name: 'Zamestnanec 4', selected: true, blockedDays: [], requiredDays: [] },
];

function App() {
  const [totalDays, setTotalDays] = useState<number>(31);
  const [employees, setEmployees] = useState<Employee[]>(defaultEmployees);
  const [holidays, setHolidays] = useState<number[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>(
    Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      employees: [],
      locked: false
    }))
  );
  const [error, setError] = useState<string>('');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [nameError, setNameError] = useState<{ [key: number]: string }>({});

  const checkConsecutiveWorkDays = (schedule: Schedule[], employeeName: string): boolean => {
    const employee = employees.find(emp => emp.name === employeeName);
    const maxAllowedDays = employee?.maxConsecutiveDays || 5;
    
    let consecutiveDays = 0;
    let maxConsecutive = 0;
    
    for (let i = 0; i < schedule.length; i++) {
      if (holidays.includes(i + 1)) {
        // Reset consecutive days counter on holidays
        consecutiveDays = 0;
        continue;
      }
      
      if (schedule[i]?.employees.includes(employeeName)) {
        consecutiveDays++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
      } else {
        consecutiveDays = 0;
      }
    }
    
    return maxConsecutive > maxAllowedDays;
  };

  const getEmployeeWorkDays = (employeeName: string) => {
    return schedule.filter(day => day.employees.includes(employeeName)).length;
  };

  const resetToDefault = () => {
    setTotalDays(31);
    setEmployees(defaultEmployees);
    setHolidays([]);
    setSchedule(Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      employees: [],
      locked: false
    })));
    setError('');
    setExpandedDay(null);
    setNameError({});
  };

  const handleEmployeeNameChange = (id: number, newName: string) => {
    const oldEmployee = employees.find(emp => emp.id === id);
    if (!oldEmployee) return;

    setEmployees(prevEmployees => {
      const updatedEmployees = prevEmployees.map(emp => {
        if (emp.id === id) {
          return {
            ...emp,
            name: newName
          };
        }
        return emp;
      });
      
      setSchedule(prevSchedule => 
        prevSchedule.map(day => ({
          ...day,
          employees: day.employees.map(name => 
            name === oldEmployee.name ? newName : name
          )
        }))
      );
      
      return updatedEmployees;
    });

    setNameError(prev => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });
  };

  const handleNameBlur = (id: number, currentName: string) => {
    if (!currentName.trim()) {
      setNameError(prev => ({
        ...prev,
        [id]: 'Meno zamestnanca nemôže byť prázdne'
      }));
      handleEmployeeNameChange(id, `Zamestnanec ${id}`);
    }
  };

  const generateSchedule = (preserveLocked: boolean = true) => {
    setError('');
    
    if (totalDays > 31) {
      setError('Celkový počet dní nemôže byť väčší ako 31');
      return;
    }

    const selectedEmployees = employees.filter(e => e.selected);

    if (selectedEmployees.length < MIN_WORKERS_PER_DAY) {
      setError(`Potrebujete aspoň ${MIN_WORKERS_PER_DAY} zamestnancov na generovanie rozvrhu.`);
      return;
    }

    // Verify required days don't conflict with blocked days or holidays
    for (const employee of selectedEmployees) {
      const conflicts = employee.requiredDays.filter(day => 
        employee.blockedDays.includes(day) || holidays.includes(day)
      );
      if (conflicts.length > 0) {
        setError(`${employee.name} má konflikt medzi povinnými dňami a blokovanými dňami/sviatkami: ${conflicts.join(', ')}`);
        return;
      }
    }

    let newSchedule: Schedule[] = Array.from({ length: totalDays }, (_, i) => {
      if (preserveLocked && schedule[i] && schedule[i].locked) {
        return schedule[i];
      }
      
      // Add employees who have this day as required
      const requiredEmployees = selectedEmployees
        .filter(emp => emp.requiredDays.includes(i + 1))
        .map(emp => emp.name);
      
      return {
        day: i + 1,
        employees: requiredEmployees,
        locked: false
      };
    });

    // Check if any day has too many required employees
    for (let i = 0; i < totalDays; i++) {
      const requiredCount = newSchedule[i].employees.length;
      if (requiredCount > MAX_WORKERS_PER_DAY) {
        setError(`Deň ${i + 1} má príliš veľa povinných zamestnancov (${requiredCount}). Maximum je ${MAX_WORKERS_PER_DAY}.`);
        return;
      }
    }

    const unlockedDays = Array.from({ length: totalDays }, (_, i) => i)
      .filter(i => !newSchedule[i].locked && !holidays.includes(i + 1));

    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      let success = true;
      let failureReason = '';
      
      // First pass: ensure minimum number of employees per day for unlocked days
      for (let dayIndex of unlockedDays) {
        const currentEmployees = newSchedule[dayIndex].employees;
        const neededEmployees = MIN_WORKERS_PER_DAY - currentEmployees.length;
        
        if (neededEmployees > 0) {
          const availableEmployees = selectedEmployees.filter(employee => {
            if (currentEmployees.includes(employee.name)) return false;
            if (employee.blockedDays.includes(dayIndex + 1)) return false;
            if (holidays.includes(dayIndex + 1)) return false;
            
            const tempSchedule = [...newSchedule];
            tempSchedule[dayIndex] = {
              ...tempSchedule[dayIndex],
              employees: [...currentEmployees, employee.name]
            };
            return !checkConsecutiveWorkDays(tempSchedule, employee.name);
          });

          if (availableEmployees.length < neededEmployees) {
            success = false;
            const blockedEmployees = selectedEmployees
              .filter(emp => emp.blockedDays.includes(dayIndex + 1))
              .map(emp => emp.name);
            
            failureReason = `Pre deň ${dayIndex + 1} nie je dostatok dostupných zamestnancov.\n` +
              `- Potrebných: ${neededEmployees}\n` +
              `- Dostupných: ${availableEmployees.length}\n` +
              `- Už naplánovaní: ${currentEmployees.join(', ') || 'nikto'}\n` +
              `- Blokovaní: ${blockedEmployees.join(', ') || 'nikto'}\n` +
              `- Ostatní nemôžu pracovať kvôli limitu po sebe idúcich dní`;
            break;
          }

          // Randomly select needed employees
          for (let i = 0; i < neededEmployees; i++) {
            const randomIndex = Math.floor(Math.random() * availableEmployees.length);
            const selectedEmployee = availableEmployees[randomIndex];
            newSchedule[dayIndex].employees.push(selectedEmployee.name);
            availableEmployees.splice(randomIndex, 1);
          }
        }
      }

      if (!success) {
        attempts++;
        if (attempts === maxAttempts) {
          setError(`Nepodarilo sa vygenerovať platný rozvrh po ${maxAttempts} pokusoch.\nDôvod: ${failureReason}`);
          return;
        }
        
        // Reset unlocked days in schedule
        newSchedule = Array.from({ length: totalDays }, (_, i) => {
          if (preserveLocked && schedule[i] && schedule[i].locked) {
            return schedule[i];
          }
          
          // Keep required employees
          const requiredEmployees = selectedEmployees
            .filter(emp => emp.requiredDays.includes(i + 1))
            .map(emp => emp.name);
          
          return {
            day: i + 1,
            employees: requiredEmployees,
            locked: false
          };
        });
        
        continue;
      }

      // Second pass: try to add additional employees up to MAX_WORKERS_PER_DAY
      for (let dayIndex of unlockedDays) {
        while (newSchedule[dayIndex].employees.length < MAX_WORKERS_PER_DAY) {
          const availableEmployees = selectedEmployees.filter(employee => {
            if (newSchedule[dayIndex].employees.includes(employee.name)) return false;
            if (employee.blockedDays.includes(dayIndex + 1)) return false;
            if (holidays.includes(dayIndex + 1)) return false;
            
            const tempSchedule = [...newSchedule];
            tempSchedule[dayIndex] = {
              ...tempSchedule[dayIndex],
              employees: [...tempSchedule[dayIndex].employees, employee.name]
            };
            return !checkConsecutiveWorkDays(tempSchedule, employee.name);
          });

          if (availableEmployees.length === 0) break;

          const randomEmployee = availableEmployees[Math.floor(Math.random() * availableEmployees.length)];
          newSchedule[dayIndex].employees.push(randomEmployee.name);
        }
      }

      // Verify all days have at least MIN_WORKERS_PER_DAY employees or are holidays
      if (newSchedule.every(day => holidays.includes(day.day) || day.employees.length >= MIN_WORKERS_PER_DAY)) {
        // Lock all days that have employees assigned
        newSchedule = newSchedule.map(day => ({
          ...day,
          locked: day.employees.length > 0
        }));
        setSchedule(newSchedule);
        return;
      }

      // Reset for next attempt
      newSchedule = Array.from({ length: totalDays }, (_, i) => {
        if (preserveLocked && schedule[i] && schedule[i].locked) {
          return schedule[i];
        }
        
        // Keep required employees
        const requiredEmployees = selectedEmployees
          .filter(emp => emp.requiredDays.includes(i + 1))
          .map(emp => emp.name);
        
        return {
          day: i + 1,
          employees: requiredEmployees,
          locked: false
        };
      });
      
      attempts++;
    }

    setError(`Nepodarilo sa vygenerovať platný rozvrh po ${maxAttempts} pokusoch. Skúste upraviť parametre ako blokované dni alebo povinné dni.`);
  };

  const downloadCSV = () => {
    const selectedEmployees = employees.filter(e => e.selected).map(e => e.name);
    const header = ['Den', ...selectedEmployees].join(';');
    const rows = schedule.map(day => {
      const employeeColumns = selectedEmployees.map(emp => 
        day.employees.includes(emp) ? '1' : '0'
      );
      return [day.day, ...employeeColumns].join(';');
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'rozpis_prace.csv';
    link.click();
  };

  const toggleEmployeeForDay = (dayIndex: number, employeeName: string) => {
    const employee = employees.find(emp => emp.name === employeeName);
    if (!employee) return;

    if (employee.blockedDays.includes(dayIndex + 1)) {
      setError(`${employeeName} nemôže pracovať v tento deň (blokovaný)`);
      return;
    }

    if (holidays.includes(dayIndex + 1)) {
      setError(`${employeeName} nemôže pracovať v tento deň (sviatok)`);
      return;
    }

    setSchedule(prevSchedule => {
      const newSchedule = [...prevSchedule];
      const day = { ...newSchedule[dayIndex] };
      
      if (day.employees.includes(employeeName)) {
        if (employee.requiredDays.includes(dayIndex + 1)) {
          setError(`${employeeName} musí pracovať v tento deň (povinný)`);
          return prevSchedule;
        }
        day.employees = day.employees.filter(name => name !== employeeName);
      } else {
        if (day.employees.length >= MAX_WORKERS_PER_DAY) {
          setError(`Každý deň môže mať maximálne ${MAX_WORKERS_PER_DAY} zamestnancov`);
          return prevSchedule;
        }

        const tempSchedule = [...newSchedule];
        tempSchedule[dayIndex] = {
          ...tempSchedule[dayIndex],
          employees: [...tempSchedule[dayIndex].employees, employeeName]
        };
        
        if (checkConsecutiveWorkDays(tempSchedule, employeeName)) {
          const employee = employees.find(emp => emp.name === employeeName);
          const maxDays = employee?.maxConsecutiveDays || 5;
          setError(`${employeeName} nemôže pracovať viac ako ${maxDays} dní po sebe`);
          return prevSchedule;
        }
        
        day.employees = [...day.employees, employeeName];
      }
      
      newSchedule[dayIndex] = day;
      return newSchedule;
    });
  };

  const toggleBlockedDay = (employeeId: number, day: number) => {
    setEmployees(prevEmployees => {
      return prevEmployees.map(emp => {
        if (emp.id === employeeId) {
          // Don't allow blocking if the day is required
          if (emp.requiredDays.includes(day)) {
            setError(`Nemôžete zablokovať deň ${day} pre ${emp.name}, pretože je to povinný deň`);
            return emp;
          }

          const newBlockedDays = emp.blockedDays.includes(day)
            ? emp.blockedDays.filter(d => d !== day)
            : [...emp.blockedDays, day];
          
          // Remove employee from schedule if they're blocked for this day
          if (!emp.blockedDays.includes(day)) {
            setSchedule(prevSchedule => {
              const dayIndex = day - 1;
              if (prevSchedule[dayIndex].employees.includes(emp.name)) {
                const newSchedule = [...prevSchedule];
                const updatedDay = { ...newSchedule[dayIndex] };
                updatedDay.employees = updatedDay.employees.filter(name => name !== emp.name);
                newSchedule[dayIndex] = updatedDay;
                return newSchedule;
              }
              return prevSchedule;
            });
          }
          
          return {
            ...emp,
            blockedDays: newBlockedDays
          };
        }
        return emp;
      });
    });
  };

  const toggleRequiredDay = (employeeId: number, day: number) => {
    setEmployees(prevEmployees => {
      return prevEmployees.map(emp => {
        if (emp.id === employeeId) {
          // Don't allow requiring if the day is blocked or holiday
          if (emp.blockedDays.includes(day)) {
            setError(`Nemôžete nastaviť deň ${day} ako povinný pre ${emp.name}, pretože je blokovaný`);
            return emp;
          }

          if (holidays.includes(day)) {
            setError(`Nemôžete nastaviť deň ${day} ako povinný pre ${emp.name}, pretože je to sviatok`);
            return emp;
          }

          const newRequiredDays = emp.requiredDays.includes(day)
            ? emp.requiredDays.filter(d => d !== day)
            : [...emp.requiredDays, day];
          
          // Add employee to schedule if the day is required
          if (!emp.requiredDays.includes(day)) {
            setSchedule(prevSchedule => {
              const dayIndex = day - 1;
              if (!prevSchedule[dayIndex].employees.includes(emp.name)) {
                const newSchedule = [...prevSchedule];
                const updatedDay = { ...newSchedule[dayIndex] };
                updatedDay.employees = [...updatedDay.employees, emp.name];
                newSchedule[dayIndex] = updatedDay;
                return newSchedule;
              }
              return prevSchedule;
            });
          }
          
          return {
            ...emp,
            requiredDays: newRequiredDays
          };
        }
        return emp;
      });
    });
  };

  const toggleHoliday = (day: number) => {
    setHolidays(prevHolidays => {
      // Check if any employee has this day as required
      const employeesWithRequiredDay = employees.filter(emp => emp.requiredDays.includes(day));
      if (employeesWithRequiredDay.length > 0) {
        setError(`Nemôžete nastaviť deň ${day} ako sviatok, pretože je povinný pre: ${employeesWithRequiredDay.map(emp => emp.name).join(', ')}`);
        return prevHolidays;
      }

      const newHolidays = prevHolidays.includes(day)
        ? prevHolidays.filter(d => d !== day)
        : [...prevHolidays, day];

      // Remove all employees from schedule if it's a new holiday
      if (!prevHolidays.includes(day)) {
        setSchedule(prevSchedule => {
          const dayIndex = day - 1;
          const newSchedule = [...prevSchedule];
          newSchedule[dayIndex] = {
            ...newSchedule[dayIndex],
            employees: []
          };
          return newSchedule;
        });
      }

      return newHolidays;
    });
  };

  const refreshSchedule = () => {
    generateSchedule(true);
  };

  useEffect(() => {
    if (totalDays > 31) {
      setTotalDays(31);
      setError('Celkový počet dní nemôže byť väčší ako 31');
      return;
    }

    setSchedule(Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      employees: [],
      locked: false
    })));
  }, [totalDays]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:py-12 md:px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-end gap-1 mb-4">
          <div className="flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity">
            <ArpadLogo className="w-7 h-7" />
            <span className="text-sm font-semibold tracking-wide text-gray-700">
              Arpad<span className="text-rose-500">_AI</span>
            </span>
          </div>
          <p className="text-gray-500 text-xs">verzia {APP_VERSION}</p>
        </div>
        
        <div className="flex items-center gap-3 mb-8">
          <CalendarIcon className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl md:text-3xl font-bold text-red-600">
            Thajské masáže - plánovač smien
          </h1>
        </div>
        
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 md:p-8 mb-6">
          <div className="mb-8">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Celkový počet dní (max. 31)
              </label>
              <input
                type="number"
                max={31}
                value={totalDays}
                onChange={(e) => setTotalDays(Math.min(31, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <label className="text-sm font-medium text-gray-700">
                Zamestnanci
              </label>
            </div>
            <div className="space-y-3">
              {employees.map((employee) => (
                <div key={employee.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50/80 border border-gray-100 transition-all hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={employee.selected}
                      onChange={() => {
                        setEmployees(employees.map(e =>
                          e.id === employee.id ? { ...e, selected: !e.selected } : e
                        ));
                      }}
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-[200px] relative">
                      <input
                        type="text"
                        value={employee.name}
                        onChange={(e) => handleEmployeeNameChange(employee.id, e.target.value)}
                        onBlur={(e) => handleNameBlur(employee.id, e.target.value)}
                        placeholder={`Zamestnanec ${employee.id}`}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
                      />
                      {nameError[employee.id] && (
                        <div className="absolute -bottom-6 left-0 text-xs text-red-600">
                          {nameError[employee.id]}
                        </div>
                      )}
                    </div>
                    {employee.selected && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-gray-200 text-gray-700 rounded-full border shadow-sm">
                          <span className="text-sm font-medium">
                            {getEmployeeWorkDays(employee.name)}
                          </span>
                          <span className="text-xs text-gray-500">dní</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {employee.selected && (
                    <div className="ml-7 space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <Ban size={14} className="text-red-500" />
                          Blokované dni:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                            <button
                              key={`blocked-${day}`}
                              onClick={() => toggleBlockedDay(employee.id, day)}
                              disabled={employee.requiredDays.includes(day) || holidays.includes(day)}
                              className={`w-8 h-8 text-xs font-medium rounded-lg flex items-center justify-center transition-colors ${
                                employee.requiredDays.includes(day) || holidays.includes(day)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : employee.blockedDays.includes(day)
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <LockKeyhole size={14} className="text-blue-500" />
                          Povinné dni:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                            <button
                              key={`required-${day}`}
                              onClick={() => toggleRequiredDay(employee.id, day)}
                              disabled={employee.blockedDays.includes(day) || holidays.includes(day)}
                              className={`w-8 h-8 text-xs font-medium rounded-lg flex items-center justify-center transition-colors ${
                                employee.blockedDays.includes(day) || holidays.includes(day)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : employee.requiredDays.includes(day)
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Star size={14} className="text-yellow-500" />
              Sviatky:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                const hasRequiredEmployee = employees.some(emp => emp.requiredDays.includes(day));
                return (
                  <button
                    key={`holiday-${day}`}
                    onClick={() => toggleHoliday(day)}
                    disabled={hasRequiredEmployee}
                    className={`w-8 h-8 text-xs font-medium rounded-lg flex items-center justify-center transition-colors ${
                      hasRequiredEmployee
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : holidays.includes(day)
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-4 mb-6 animate-fadeIn relative flex items-start justify-between gap-3">
            <pre className="text-red-700 flex-1 whitespace-pre-wrap font-mono text-sm">{error}</pre>
            <button
              onClick={() => setError('')}
              className="shrink-0 p-1.5 hover:bg-red-100 rounded-full transition-colors"
              aria-label="Zavrieť hlášku"
            >
              <X size={18} className="text-red-600" />
            </button>
          </div>
        )}

        {schedule.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Rozpis práce</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-600">V práci</span>
                  </div>
                  <div className="flex items-center gap-2">
                    
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-600">Voľno</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-gray-600">Uzamknuté</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-600">Sviatok</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={resetToDefault}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
                <button
                  onClick={refreshSchedule}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <RefreshCw size={16} />
                  Prepočítať
                </button>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {schedule.map((day, index) => (
                <div 
                  key={index} 
                  className={`bg-gray-50/80 rounded-lg border ${
                    holidays.includes(day.day)
                      ? 'border-yellow-200'
                      : day.locked
                        ? 'border-blue-200'
                        : 'border-gray-100'
                  } transition-all hover:bg-gray-50`}
                >
                  <button
                    onClick={() => setExpandedDay(expandedDay === index ? null : index)}
                    className="w-full px-4 py-3 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-900">Deň {day.day}</span>
                      {holidays.includes(day.day) ? (
                        <div className="px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-800">
                          Sviatok
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {day.employees.map((emp, i) => {
                            const employee = employees.find(e => e.name === emp);
                            return (
                              <div
                                key={i}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                  employee?.requiredDays.includes(day.day)
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {emp}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {expandedDay === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {expandedDay === index && !holidays.includes(day.day) && (
                    <div className="px-4 pb-3 pt-1">
                      <div className="flex flex-wrap gap-2">
                        {employees
                          .filter(emp => emp.selected)
                          .map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => toggleEmployeeForDay(index, emp.name)}
                              disabled={emp.blockedDays.includes(index + 1) || holidays.includes(index + 1)}
                              className={`px-4 py-2 text-sm rounded-lg transition-all flex items-center gap-2 hover:shadow-md ${
                                emp.blockedDays.includes(index + 1) || holidays.includes(index + 1)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : emp.requiredDays.includes(index + 1)
                                  ? 'bg-blue-100 text-blue-800'
                                  : day.employees.includes(emp.name)
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {emp.blockedDays.includes(index + 1) ? (
                                <Ban size={14} />
                              ) : emp.requiredDays.includes(index + 1) ? (
                                <LockKeyhole size={14} />
                              ) : day.employees.includes(emp.name) ? (
                                <Calendar size={14} />
                              ) : (
                                <CalendarOff size={14} />
                              )}
                              {emp.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;