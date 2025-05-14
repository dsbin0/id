const InvestmentCategory = require("../models/InvestmentCategory");

const categoryController = {
  async getAllCategories(req, res) {
    try {
      const categories = await InvestmentCategory.getAll();
      if (!categories || categories.length === 0) {
        return res.status(404).json({ message: "Nenhuma categoria de investimento encontrada." });
      }
      res.status(200).json(categories);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar categorias." });
    }
  },

  async getCategoryById(req, res) {
    try {
      const { id } = req.params;
      const category = await InvestmentCategory.findById(id);
      if (!category) {
        return res.status(404).json({ message: "Categoria de investimento não encontrada." });
      }
      res.status(200).json(category);
    } catch (error) {
      console.error("Erro ao buscar categoria por ID:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar categoria por ID." });
    }
  }
  // Add other controller methods if create/update/delete for categories are needed later
};

module.exports = categoryController;

