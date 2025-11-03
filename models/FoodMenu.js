// models/FoodMenu.js
import mongoose from "mongoose";

const foodMenuSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },
    mealType: {
      type: String,
      enum: ["Breakfast", "Lunch", "Dinner"],
      required: true,
    },
    menuItems: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true, // ⏰ Auto manages createdAt & updatedAt
  }
);

const FoodMenu = mongoose.model("FoodMenu", foodMenuSchema);
export default FoodMenu;
