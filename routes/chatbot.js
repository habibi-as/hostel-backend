const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Predefined Q&A for chatbot
const chatbotData = {
  "hostel_rules": {
    "question": "What are the hostel rules?",
    "answer": "Hostel rules include: 1) Curfew time is 10 PM, 2) No smoking or alcohol, 3) Keep rooms clean, 4) Respect other students, 5) Follow meal timings, 6) No unauthorized visitors after 8 PM."
  },
  "meal_timings": {
    "question": "What are the meal timings?",
    "answer": "Meal timings are: Breakfast: 7:00 AM - 9:00 AM, Lunch: 12:00 PM - 2:00 PM, Dinner: 7:00 PM - 9:00 PM. Please follow these timings strictly."
  },
  "visitor_policy": {
    "question": "What is the visitor policy?",
    "answer": "Visitors are allowed from 9 AM to 8 PM. All visitors must register at the reception with valid ID proof. Students are responsible for their visitors' conduct."
  },
  "laundry_service": {
    "question": "How does laundry service work?",
    "answer": "Laundry service is available Monday to Friday. Submit your clothes at the laundry counter before 10 AM. Clothes will be ready for pickup the next day. Charges apply as per the rate card."
  },
  "maintenance_requests": {
    "question": "How to request maintenance?",
    "answer": "Submit maintenance requests through the hostel portal or contact the maintenance office. For urgent issues, call the emergency number. Include detailed description of the problem."
  },
  "fees_payment": {
    "question": "How to pay hostel fees?",
    "answer": "Fees can be paid online through the portal or at the admin office. Payment methods include cash, card, or bank transfer. Keep the receipt for your records."
  },
  "emergency_contacts": {
    "question": "What are the emergency contacts?",
    "answer": "Emergency contacts: Security: +91-XXXX-XXXX, Admin: +91-XXXX-XXXX, Medical: +91-XXXX-XXXX. For fire emergency, call 101."
  },
  "room_allocation": {
    "question": "How is room allocation done?",
    "answer": "Rooms are allocated based on availability, batch, and preferences. Contact the admin office for room change requests. Room swapping is not allowed without permission."
  },
  "internet_wifi": {
    "question": "What about internet and WiFi?",
    "answer": "Free WiFi is available in common areas and rooms. Internet usage is monitored. No downloading of inappropriate content. Report connectivity issues to the IT support."
  },
  "library_facilities": {
    "question": "What library facilities are available?",
    "answer": "Library is open from 8 AM to 10 PM. Books can be issued for 15 days. Late return charges apply. Maintain silence in the library. No food or drinks allowed."
  }
};

// Get chatbot response
router.post('/ask', authenticateToken, requireAnyRole, [
  body('question').notEmpty().withMessage('Question is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { question } = req.body;
    const userQuestion = question.toLowerCase();

    // Simple keyword matching for responses
    let response = "I'm sorry, I couldn't find a specific answer to your question. Please contact the admin office for assistance.";

    // Check for keywords and provide appropriate responses
    if (userQuestion.includes('rule') || userQuestion.includes('regulation')) {
      response = chatbotData.hostel_rules.answer;
    } else if (userQuestion.includes('meal') || userQuestion.includes('food') || userQuestion.includes('timing')) {
      response = chatbotData.meal_timings.answer;
    } else if (userQuestion.includes('visitor') || userQuestion.includes('guest')) {
      response = chatbotData.visitor_policy.answer;
    } else if (userQuestion.includes('laundry') || userQuestion.includes('wash')) {
      response = chatbotData.laundry_service.answer;
    } else if (userQuestion.includes('maintenance') || userQuestion.includes('repair') || userQuestion.includes('fix')) {
      response = chatbotData.maintenance_requests.answer;
    } else if (userQuestion.includes('fee') || userQuestion.includes('payment') || userQuestion.includes('money')) {
      response = chatbotData.fees_payment.answer;
    } else if (userQuestion.includes('emergency') || userQuestion.includes('contact') || userQuestion.includes('help')) {
      response = chatbotData.emergency_contacts.answer;
    } else if (userQuestion.includes('room') || userQuestion.includes('allocation') || userQuestion.includes('change')) {
      response = chatbotData.room_allocation.answer;
    } else if (userQuestion.includes('wifi') || userQuestion.includes('internet') || userQuestion.includes('network')) {
      response = chatbotData.internet_wifi.answer;
    } else if (userQuestion.includes('library') || userQuestion.includes('book') || userQuestion.includes('study')) {
      response = chatbotData.library_facilities.answer;
    }

    res.json({
      success: true,
      data: {
        question,
        answer: response,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chatbot request'
    });
  }
});

// Get FAQ list
router.get('/faq', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const faqList = Object.values(chatbotData).map(item => ({
      question: item.question,
      answer: item.answer
    }));

    res.json({
      success: true,
      data: faqList
    });

  } catch (error) {
    console.error('Get FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ'
    });
  }
});

// Add new FAQ (Admin only)
router.post('/faq', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { question, answer, keywords } = req.body;

    // In a real application, you would save this to a database
    // For now, we'll just return a success message
    res.status(201).json({
      success: true,
      message: 'FAQ added successfully',
      data: {
        question,
        answer,
        keywords
      }
    });

  } catch (error) {
    console.error('Add FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add FAQ'
    });
  }
});

module.exports = router;
