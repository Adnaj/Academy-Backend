const M = require("../models/leads");
const V = require("../validators/lead.validator");

// One entry per lead form. `key` is the URL: /api/leads/<key>
//  fields  = the rows shown in the notification email: [fieldName, label]
//  filters = extra ?query filters for the admin list, search = fields searched by ?search=
const contactFields = [
  ["name", "Name"], ["phone", "Phone"], ["programme", "Programme"],
  ["mode", "Mode"], ["location", "Location"], ["message", "Message"],
];

module.exports = [
  {
    key: "contact",
    label: "Contact page",
    thanks: "Thanks! Our advisors will contact you shortly.",
    Model: M.ContactLead,
    schema: V.contactSchema,
    fields: contactFields,
    filters: ["mode", "location", "programme"],
    search: ["name", "phone", "message"],
  },
  {
    key: "guidance",
    label: "Guidance form",
    thanks: "Thanks! Our advisors will contact you shortly.",
    Model: M.GuidanceLead,
    schema: V.contactSchema,
    fields: contactFields,
    filters: ["mode", "location", "programme"],
    search: ["name", "phone", "message"],
  },
  {
    key: "popup",
    label: "Popup enquiry",
    thanks: "Thanks! Our team will get in touch with you soon.",
    Model: M.PopupLead,
    schema: V.popupSchema,
    fields: [
      ["name", "Name"], ["phone", "Phone"], ["formTitle", "Form"], ["source", "Button / source"],
      ["courseTitle", "Course"], ["course", "Course key"], ["category", "Category"],
      ["studyMode", "Study mode"], ["pageUrl", "Page"],
    ],
    filters: ["source", "course", "category", "studyMode"],
    search: ["name", "phone", "courseTitle", "formTitle"],
  },
  {
    key: "online-course",
    label: "Online course call back",
    thanks: "Thank you! Our team will call you back shortly.",
    Model: M.OnlineCourseLead,
    schema: V.onlineCourseSchema,
    fields: [["name", "Name"], ["phone", "Phone"], ["courseTitle", "Course"], ["message", "Message"], ["pageUrl", "Page"]],
    filters: ["courseTitle"],
    search: ["name", "phone", "courseTitle", "message"],
  },
  {
    key: "offline-course",
    label: "Offline course call back",
    thanks: "Thank you! Our team will call you back shortly.",
    Model: M.OfflineCourseLead,
    schema: V.offlineCourseSchema,
    fields: [
      ["name", "Name"], ["phone", "Phone"], ["location", "Campus"],
      ["courseTitle", "Course"], ["message", "Message"], ["pageUrl", "Page"],
    ],
    filters: ["location", "courseTitle"],
    search: ["name", "phone", "courseTitle", "message"],
  },
];