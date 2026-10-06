
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw,
Search,
Plus,Download,
Upload
} from "lucide-react";

const FILTERS = [
  "ALL",
  "PARENT",
  "TEACHER",
  "ADMIN",
  "STUDENT",
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [showAddUser, setShowAddUser] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState("");

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);

  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    roles: [],
  });

  const [createdCredentials, setCreatedCredentials] = useState(null);

  // ----------------------------------
  // GET USERS + STUDENTS
  // ----------------------------------

  const fetchRecords = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to retrieve users."
        );
      }

      setUsers(data.users || []);
      setStudents(data.students || []);
      setError("");
    } catch (err) {
      console.error("ADMIN USERS:", err);
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchRecords(true);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchRecords]);

  // ----------------------------------
  // SEARCH + FILTER
  // ----------------------------------

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        filter === "ALL" ||
        user.roles.includes(filter);

      const matchesSearch =
        user.name.toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.phone || "").toLowerCase().includes(query) ||
        String(user.user_id).includes(query);

      return matchesRole && matchesSearch;
    });
  }, [users, filter, search]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        (student.classroom_name || "")
          .toLowerCase()
          .includes(query) ||
        String(student.student_id).includes(query) ||
        (student.parent_names || "").toLowerCase().includes(query)

      );
    });
  }, [students, search]);

  // ----------------------------------
  // UPDATE ACCOUNT STATUS
  // ----------------------------------

  async function handleStatusChange(user) {
    if (updatingId !== null) return;

    const nextStatus = !user.is_active;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name}'s account?`
    );

    if (!confirmed) return;

    try {
      setUpdatingId(user.user_id);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/admin/users/${user.user_id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: nextStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to update account."
        );
      }

      setMessage(data.message);

      // Refresh immediately after a successful change.
      await fetchRecords(true);
    } catch (err) {
      console.error("USER STATUS UPDATE:", err);
      setError(err.message || "Unable to update account.");
    } finally {
      setUpdatingId(null);
    }
  }

  const displayedCount =
    filter === "STUDENT"
      ? filteredStudents.length
      : filteredUsers.length;

function openAddUser() {
  setNewUser({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    roles: [],
  });

  setCreateError("");
  setCreatedCredentials(null);
  setShowAddUser(true);
}

function closeAddUser() {
  if (creatingUser) return;

  setShowAddUser(false);
  setCreatedCredentials(null);
  setCreateError("");
}

function updateNewUser(field, value) {
  setNewUser((previous) => ({
    ...previous,
    [field]: value,
  }));
}

function toggleNewUserRole(role) {
  setNewUser((previous) => ({
    ...previous,
    roles: previous.roles.includes(role)
      ? previous.roles.filter((item) => item !== role)
      : [...previous.roles, role],
  }));
}

async function handleCreateUser(event) {
  event.preventDefault();

  if (creatingUser) return;

  setCreateError("");

  if (newUser.roles.length === 0) {
    setCreateError("Select at least one account role.");
    return;
  }

  try {
    setCreatingUser(true);

    const response = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newUser),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to create user."
      );
    }

    // Display the generated password once.
    // Do not store it in localStorage/sessionStorage.
    setCreatedCredentials({
      name: `${data.user.first_name} ${data.user.last_name}`,
      email: data.user.email,
      password: data.temporary_password,
    });

    setMessage("New account created successfully.");

    // Update the main User Management table.
    await fetchRecords(true);
  } catch (error) {
    console.error("CREATE USER ERROR:", error.message);
    setCreateError(error.message);
  } finally {
    setCreatingUser(false);
  }
}

async function handleImport(event) {
  event.preventDefault();

  if (!importFile || importing) return;

  try {
    setImporting(true);
    setImportError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);

    const response = await fetch("/api/admin/users/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to import CSV."
      );
    }

    setImportResult(data);

    // Reload the User Management table.
    await fetchRecords(true);
  } catch (error) {
    console.error("CSV IMPORT:", error);
    setImportError(error.message);
  } finally {
    setImporting(false);
  }
}

function closeImport() {
  if (importing) return;

  setShowImport(false);
  setImportFile(null);
  setImportResult(null);
  setImportError("");
}


  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            User Management
          </h1>

          <p className="mt-1 text-sm text-gray-400">
            Manage parent, teacher and administrator accounts
          </p>
        </div>

        
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openAddUser}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <Plus size={16} />
          Add User
        </button>

        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-100"
        >
          <Upload size={16} />
          Import CSV
        </button>

        <a
          href="/api/admin/users/export"
          download
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-100"
        >
          <Download size={16} />
          Export CSV
        </a>

        <button
          type="button"
          onClick={() => fetchRecords(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          <RefreshCw size={16} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      {/* FILTER TABS */}
      <div className="mt-8 flex gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setFilter(item);
              setSearch("");
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filter === item
                ? "bg-black text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* TABLE CONTAINER */}
      <section className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white">

        {/* TABLE TOOLBAR */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="font-semibold">
              {filter === "STUDENT"
                ? "Student Records"
                : "User Accounts"}
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              {displayedCount} records displayed
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
            <Search size={16} className="text-gray-400" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={
                filter === "STUDENT"
                  ? "Search student or classroom"
                  : "Search name, email or phone number"
              }
              className="w-64 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">

          {filter === "STUDENT" ? (
            /* STUDENT RECORDS */
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4">Student ID</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Classroom</th>
                  <th className="px-6 py-4">Parent</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      Loading students...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No matching students.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.student_id}
                      className="border-t border-gray-100"
                    >
                      <td className="px-6 py-5 text-gray-500">
                        {student.student_id}
                      </td>

                      <td className="px-6 py-5 font-semibold">
                        {student.name}
                      </td>

                      <td className="px-6 py-5">
                        {student.classroom_name || "—"}
                      </td>

                      <td className="px-6 py-5 font-medium text-gray-700">
                          {student.parent_names || "No parent assigned"}
                            
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* USER ACCOUNTS */
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Roles</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      Loading accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No matching accounts.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.user_id}
                      className="border-t border-gray-100"
                    >
                      <td className="px-6 py-5">
                        <p className="font-semibold">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          ID: {user.user_id}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-gray-500">
                        {user.email || "—"}
                      </td>
                      <td className="px-6 py-5 text-gray-500 tabular-nums">
                        {user.phone || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600"
                            >
                              {role}
                            </span>
                          ))}
                          {user.roles.length === 0 && "—"}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleStatusChange(user)
                          }
                          disabled={updatingId !== null}
                          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                            user.is_active
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {updatingId === user.user_id
                            ? "Updating..."
                            : user.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

        </div>

        <div className="border-t border-gray-100 px-6 py-4 text-xs text-gray-400">
          {filter === "STUDENT"
            ? "Students are separate records and do not have login accounts."
            : "Accounts may hold multiple roles. Deactivation preserves existing role assignments."}
        </div>
      </section>


{/* ADD USER MODAL */}
{showAddUser && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-title"
      className="w-full max-w-lg rounded-xl bg-white shadow-xl"
    >
      {/* MODAL HEADER */}
      <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
        <div>
          <h2
            id="add-user-title"
            className="text-lg font-bold"
          >
            {createdCredentials
              ? "Account Created"
              : "Add New User"}
          </h2>

          <p className="mt-1 text-xs text-gray-400">
            {createdCredentials
              ? "Save the temporary credentials before closing."
              : "Create a new ATG account and assign its roles."}
          </p>
        </div>

        <button
          type="button"
          onClick={closeAddUser}
          disabled={creatingUser}
          aria-label="Close"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      {/* SUCCESS: TEMPORARY CREDENTIALS */}
      {createdCredentials ? (
        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              User created successfully
            </p>

            <p className="mt-1 text-xs text-green-700">
              These credentials are displayed only once.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500">
              Account Name
            </p>
            <p className="mt-1 text-sm font-medium">
              {createdCredentials.name}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500">
              Email
            </p>
            <p className="mt-1 text-sm">
              {createdCredentials.email}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500">
              Temporary Password
            </p>

            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <code className="break-all text-sm font-semibold">
                {createdCredentials.password}
              </code>

              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    createdCredentials.password
                  ).catch(() =>
                    setCreateError("Could not copy password.")
                  )
                }
                className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-100"
              >
                Copy
              </button>
            </div>
          </div>

          <p className="text-xs leading-5 text-gray-500">
            Provide the temporary credentials to the account
            owner through an appropriate private channel.
            The password cannot be retrieved from this screen
            after closing.
          </p>

          {createError && (
            <p role="alert" className="text-xs text-red-600">
              {createError}
            </p>
          )}

          <button
            type="button"
            onClick={closeAddUser}
            className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Done
          </button>
        </div>
      ) : (
        /* CREATE USER FORM */
        <form
          onSubmit={handleCreateUser}
          className="space-y-5 p-6"
        >
          {createError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600"
            >
              {createError}
            </div>
          )}

          {/* NAME */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-first-name"
                className="mb-2 block text-xs font-semibold"
              >
                First Name
              </label>

              <input
                id="new-first-name"
                type="text"
                required
                maxLength={100}
                value={newUser.first_name}
                onChange={(event) =>
                  updateNewUser(
                    "first_name",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="First name"
              />
            </div>

            <div>
              <label
                htmlFor="new-last-name"
                className="mb-2 block text-xs font-semibold"
              >
                Last Name
              </label>

              <input
                id="new-last-name"
                type="text"
                required
                maxLength={100}
                value={newUser.last_name}
                onChange={(event) =>
                  updateNewUser(
                    "last_name",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="Last name"
              />
            </div>
          </div>

          {/* EMAIL */}
          <div>
            <label
              htmlFor="new-email"
              className="mb-2 block text-xs font-semibold"
            >
              Email Address
            </label>

            <input
              id="new-email"
              type="email"
              required
              maxLength={255}
              value={newUser.email}
              onChange={(event) =>
                updateNewUser("email", event.target.value)
              }
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
              placeholder="example@school.com"
            />
          </div>

          {/* PHONE */}
          <div>
            <label
              htmlFor="new-phone"
              className="mb-2 block text-xs font-semibold"
            >
              Phone Number (Parent / Teacher Profile)
            </label>

            <input
              id="new-phone"
              type="tel"
              maxLength={30}
              value={newUser.phone}
              onChange={(event) =>
                updateNewUser("phone", event.target.value)
              }
              disabled={
                  !newUser.roles.some((role) =>
                    ["PARENT", "TEACHER"].includes(role)
                  )
                }
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="Optional"
            />
          </div>

          {/* ROLE SELECTION */}
          <fieldset>
            <legend className="mb-3 block text-xs font-semibold">
              Account Roles
            </legend>

            <div className="grid grid-cols-3 gap-3">
              {["PARENT", "TEACHER", "ADMIN"].map((role) => (
                <label
                  key={role}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-xs font-semibold transition ${
                    newUser.roles.includes(role)
                      ? "border-black bg-black text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newUser.roles.includes(role)}
                    onChange={() => toggleNewUserRole(role)}
                    className="sr-only"
                  />

                  {role}
                </label>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Multiple roles can be assigned to one account.
            </p>
          </fieldset>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={closeAddUser}
              disabled={creatingUser}
              className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                creatingUser || newUser.roles.length === 0
              }
              className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {creatingUser
                ? "Creating..."
                : "Create User"}
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
)}

{/* IMPORT CSV MODAL */}

{showImport && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      className="w-full max-w-xl rounded-xl bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
        <div>
          <h2 id="import-title" className="text-lg font-bold">
            Import Users
          </h2>

          <p className="mt-1 text-xs text-gray-400">
            Bulk-create accounts using a CSV file.
          </p>
        </div>

        <button
          type="button"
          onClick={closeImport}
          disabled={importing}
          aria-label="Close import"
          className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
        {!importResult ? (
          <form onSubmit={handleImport} className="space-y-5">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold">
                Required CSV columns
              </p>

              <code className="mt-2 block break-all text-xs text-gray-600">
                first_name,last_name,email,phone_number,roles
              </code>

              <p className="mt-3 text-xs text-gray-500">
                Separate multiple roles using |, for example
                PARENT|TEACHER. Maximum 100 users per file.
              </p>
            </div>

            <div>
              <label
                htmlFor="users-csv"
                className="mb-2 block text-xs font-semibold"
              >
                Select CSV File
              </label>

              <input
                id="users-csv"
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => {
                  setImportFile(
                    event.target.files?.[0] || null
                  );
                  setImportError("");
                }}
                className="w-full rounded-lg border border-gray-200 p-3 text-sm"
              />
            </div>

            {importError && (
              <p role="alert" className="text-xs text-red-600">
                {importError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={closeImport}
                disabled={importing}
                className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!importFile || importing}
                className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {importing ? "Importing..." : "Import Users"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Total", importResult.summary.total],
                ["Created", importResult.summary.created],
                ["Failed", importResult.summary.failed],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg bg-gray-50 p-4"
                >
                  <p className="text-xs text-gray-500">
                    {label}
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Row Results
              </h3>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {importResult.results.map((result) => (
                  <div
                    key={result.row}
                    className="flex justify-between gap-3 border-b border-gray-100 p-3 text-xs last:border-none"
                  >
                    <div>
                      <p className="font-semibold">
                        Row {result.row}: {result.email}
                      </p>

                      <p className="mt-1 text-gray-500">
                        {result.message}
                      </p>
                    </div>

                    <span
                      className={
                        result.status === "CREATED"
                          ? "font-semibold text-green-700"
                          : "font-semibold text-red-600"
                      }
                    >
                      {result.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {importResult.credentials.length > 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Temporary Credentials
                  </h3>

                  <p className="mt-1 text-xs text-red-600">
                    Shown only once. Save securely before closing.
                    Do not share this list publicly.
                  </p>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                  {importResult.credentials.map((account) => (
                    <div
                      key={account.email}
                      className="border-b border-gray-100 p-3 last:border-none"
                    >
                      <p className="text-xs font-semibold">
                        {account.email}
                      </p>

                      <code className="mt-2 block break-all text-xs text-gray-600">
                        {account.temporary_password}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={closeImport}
              className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}

    </main>
  );
}
