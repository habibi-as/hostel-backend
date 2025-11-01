const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAnyRole, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 💬 Predefined FAQ / Chatbot dataset
const chatbotData = {
  hostel_rules: {
    question: "What are the hostel rules?",
    answer: "Hostel rules include: 1) Curfew time is 10 PM, 2) No smoking or alcohol, 3) Keep rooms clean, 4) Respect others, 5) Follow meal timings, 6) No unauthorized visitors after 8 PM."
  },
  meal_timings: {
    question: "What are the meal timings?",
    answer: "Breakfast: 7–9 AM, Lunch: 12–2 PM, Dinner: 7–9 PM. Please follow these timings strictly."
  },
  visitor_policy: {
    question: "What is the visitor policy?",
    answer: "Visitors are allowed from 9 AM–8 PM. All must register at reception with valid ID. Students are responsible for visitor behavior."
  },
  laundry_service: {
    question: "How does laundry service work?",
    answer: "Laundry is available Monday–Friday. Submit clothes before 10 AM; pickup next day. Charges apply per rate card."
  },
  maintenance_requests: {
    question: "How to request maintenance?",
    answer: "Submit maintenance requests via the portal or contact the maintenance office. For urgent issues, call the emergency number."
  },
  fees_payment: {
    question: "How to pay hostel fees?",
    answer: "Fees can be paid online through the portal or at the admin office. Keep the receipt for your records."
  },
  emergency_contacts: {
    question: "What are the emergency contacts?",
    answer: "Security: +91-XXXX-XXXX, Admin: +91-XXXX-XXXX, Medical: +91-XXXX-XXXX. For fire emergencies, call 101."
  },
  room_allocation: {
    question: "How is room allocation done?",
    answer: "Rooms are assigned based on availability and preferences. Contact admin for room change requests. No unauthorized swaps."
  },
  internet_wifi: {
    question: "What about internet and Wi-Fi?",
    answer: "Free Wi-Fi available in all areas. Internet usage is monitored. Report connectivity issues to IT support."
  },
  library_facilities: {
    question: "What library facilities are available?",
    answer: "Library open 8 AM–10 PM. Books can be issued for 15 days. Late return charges apply. Maintain silence."
  }
};

// 🧠 Ask Chatbot (any logged-in user)
router.post(
  '/ask',
  authenticateToken,
  requireAnyRole,
  [body('question').notEmpty().withMessage('Question is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { question } = req.body;
      const userQuestion = question.toLowerCase();

      // Default response if no keyword match
      let response =
        "I'm sorry, I couldn’t find a specific answer. Please contact the hostel admin for further assistance.";

      // 🔍 Match keywords
      if (userQuestion.includes('rule') || userQuestion.includes('regulation'))
        response = chatbotData.hostel_rules.answer;
      else if (userQuestion.includes('meal') || userQuestion.includes('food'))
        response = chatbotData.meal_timings.answer;
      else if (userQuestion.includes('visitor') || userQuestion.includes('guest'))
        response = chatbotData.visitor_policy.answer;
      else if (userQuestion.includes('laundry') || userQuestion.includes('wash'))
        response = chatbotData.laundry_service.answer;
      else if (userQuestion.includes('maintenance') || userQuestion.includes('repair'))
        response = chatbotData.maintenance_requests.answer;
      else if (userQuestion.includes('fee') || userQuestion.includes('payment'))
        response = chatbotData.fees_payment.answer;
      else if (userQuestion.includes('emergency') || userQuestion.includes('contact'))
        response = chatbotData.emergency_contacts.answer;
      else if (userQuestion.includes('room') || userQuestion.includes('allocation'))
        response = chatbotData.room_allocation.answer;
      else if (userQuestion.includes('wifi') || userQuestion.includes('internet'))
        response = chatbotData.internet_wifi.answer;
      else if (userQuestion.includes('library') || userQuestion.includes('book'))
        response = chatbotData.library_facilities.answer;

      // ✅ Success response
      return res.json({
        success: true,
        data: {
          question,
          answer: response,
          askedBy: req.user.name,
          role: req.user.role,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Chatbot error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process chatbot request',
      });
    }
  }
);

// 📚 Get all FAQs (visible to everyone logged-in)
router.get('/faq', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const faqList = Object.values(chatbotData).map(item => ({
      question: item.question,
      answer: item.answer,
    }));

    res.json({ success: true, data: faqList });
  } catch (error) {
    console.error('Get FAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FAQ' });
  }
});

// 🛠 Add new FAQ (Admin only)
router.post('/faq', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { question, answer, keywords } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question and answer are required',
      });
    }

    // (Later: Save to DB)
    res.status(201).json({
      success: true,
      message: 'FAQ added successfully',
      data: { question, answer, keywords },
    });
  } catch (error) {
    console.error('Add FAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to add FAQ' });
  }
});

export default router;

